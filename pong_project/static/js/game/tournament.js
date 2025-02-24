import { requestGet, requestPost } from "../api/index.js";
import { isTouchDevice, showStatusMessage, updateHtmlContent } from "../tools/index.js";
import { launchLiveGameWithOptions } from './live_game.js';
import { TournamentNextMatch } from './tournament_utils.js';
import { navigateTo} from "../router.js";



export async function handleTournament() {

	if (typeof localStorage !== "undefined" && !localStorage.getItem('access_token')) {
		navigateTo('/');
		return;
	}

	let tournamentParam = sessionStorage.getItem('params');
	if (tournamentParam === null)
	{
		showStatusMessage("Paramètres de tournoi invalides.", 'error');
		navigateTo('/game-options');
		return;
	}
	try {
		tournamentParam = JSON.parse(tournamentParam);
	} catch (e) {
		showStatusMessage("Erreur lors de la recuperation des Paramètres.", 'error'); 
		return;
	}
	
		
	const formHtml = await getTournamentForm();
	if (!formHtml)
		return;
	updateHtmlContent('#content', formHtml);

	
	const form = document.querySelector('#content form');
	if (!form) {
		return;
	}

	
	form.addEventListener("submit", async (event) => {
		event.preventDefault();

		
		const formData = new FormData(form);

		
		
		if (tournamentParam) {
		formData.set('ball_speed', tournamentParam.ball_speed);
		formData.set('paddle_size', tournamentParam.paddle_size);
		formData.set('bonus_enabled', tournamentParam.bonus_enabled);
		formData.set('obstacles_enabled', tournamentParam.obstacles_enabled);
		}

		formData.append('is_touch', isTouchDevice());
		try {
      const response = await createTournament(formData);
      if (response.status === 'success') {
        
        await runTournamentFlow(response.tournament_id);
      }}
    catch (error) {}
	
  });
}



async function getTournamentForm() {
  const responseGet = await requestGet('game', 'create_tournament');
  if (!responseGet)
	  return false;
  if (responseGet.status === 'success') {
    return responseGet.html;
  } 
  else if (responseGet.status === 'error') {
	showStatusMessage("Erreur lors de la récupération du formulaire du tournoi :", 'error');
	navigateTo('/game-options');
  }
}

async function createTournament(formData) {
  
  return await requestPost('game', 'create_tournament', formData);
}



async function runTournamentFlow(tournamentId) {
	window.stopTournamentFlow = false; 
  
	while (true) {
	  if (window.stopTournamentFlow) {
		break;
	  }
  
	  
	  const bracketResp = await requestGet('game', `tournament_bracket/${tournamentId}`);
	  if (!bracketResp || bracketResp.status !== "success" || window.stopTournamentFlow) {
		break;
	  }
  
	  updateHtmlContent("#content", bracketResp.html);
	  updateBracketUI(bracketResp);
	  await delay(3000);

	  if (bracketResp.tournament_status === "finished" || window.stopTournamentFlow) {
		break;
	  }
  
	  
	  const nextResp = await requestGet('game', `tournament_next_game/${tournamentId}`);
	  if (!nextResp || nextResp.status !== "success" || window.stopTournamentFlow) {
		break;
	  }
  
	  if (nextResp.next_match_type === "finished" || window.stopTournamentFlow) {
		break;
	  }
  
	  updateHtmlContent("#content", nextResp.html);
	  updateNextGameUI(bracketResp, nextResp);
	  TournamentNextMatch();
	  await delay(3000);
  
	  
	  const gameId = await createTournamentGameSession(tournamentId, nextResp.next_match_type);
	  if (!gameId || window.stopTournamentFlow) {
		showStatusMessage('Tournoi annulé ...', 'error');
		break;
	  }
  
	  
	  await launchLiveGameWithOptions(gameId, 'both', `start_tournament_game_session/${gameId}`);
	  
	  
	  const statusResponse = await requestGet('game', `get_game_status/${gameId}`);
	  if (statusResponse.status === 'error' || statusResponse.session_status !== 'finished' || window.stopTournamentFlow) {
		showStatusMessage('Tournoi annulé ...', 'error');
		break;
	  }
	}
  
	sessionStorage.removeItem('tournamentparams');
  }


function updateNextGameUI(bracketResp, nextResp) {
	
	const matchType = nextResp.next_match_type;
	
	
	let leftPlayerName = "";
	let rightPlayerName = "";
	let leftPlayerAvatar = "";
	let rightPlayerAvatar = "";
	
	
	const avatars = bracketResp.player_avatars;
	
	
	switch(matchType) {
	  case "semifinal1":
		leftPlayerName = bracketResp.player1;
		rightPlayerName = bracketResp.player2;
		leftPlayerAvatar = avatars[bracketResp.player1];
		rightPlayerAvatar = avatars[bracketResp.player2];
		break;
	  case "semifinal2":
		leftPlayerName = bracketResp.player3;
		rightPlayerName = bracketResp.player4;
		leftPlayerAvatar = avatars[bracketResp.player3];
		rightPlayerAvatar = avatars[bracketResp.player4];
		break;
	  case "final":
		
		leftPlayerName = bracketResp.winner_semifinal_1;
		rightPlayerName = bracketResp.winner_semifinal_2;
		leftPlayerAvatar = avatars[bracketResp.winner_semifinal_1] || "/static/svg/default_avatar.svg";
		rightPlayerAvatar = avatars[bracketResp.winner_semifinal_2] || "/static/svg/default_avatar.svg";
		break;
	  default:
		return;
	}
	
	
	
	const leftAvatarImg = document.querySelector(".avatar1 img.avatar");
	const leftNameElem = document.querySelector(".avatar1 .player-name");
	const rightAvatarImg = document.querySelector(".avatar2 img.avatar");
	const rightNameElem = document.querySelector(".avatar2 .player-name");
	
	if (leftAvatarImg) {
	  leftAvatarImg.src = leftPlayerAvatar;
	}
	if (leftNameElem) {
	  leftNameElem.textContent = leftPlayerName;
	}
	if (rightAvatarImg) {
	  rightAvatarImg.src = rightPlayerAvatar;
	}
	if (rightNameElem) {
	  rightNameElem.textContent = rightPlayerName;
	}
  }





function updateBracketUI(bracketResp) {
	const status = bracketResp.tournament_status;
	const name = bracketResp.tournament_name;
	const winnerSemi1 = bracketResp.winner_semifinal_1;
	const winnerSemi2 = bracketResp.winner_semifinal_2;
	const winnerFinal = bracketResp.winner_final;

	
	const playerAvatars = bracketResp.player_avatars;
	
	
    document.querySelector('.title-choosen').textContent = name

	
	document.querySelectorAll('.tournament-title p').forEach(p => p.classList.add('d-none'));
	
	
	document.querySelector('[data-player-id="1"] .avatar').src = playerAvatars[bracketResp.player1];
	document.querySelector('[data-player-id="2"] .avatar').src = playerAvatars[bracketResp.player2];
	document.querySelector('[data-player-id="3"] .avatar').src = playerAvatars[bracketResp.player3];
	document.querySelector('[data-player-id="4"] .avatar').src = playerAvatars[bracketResp.player4];
	
	document.querySelector('[data-player-id="1"] .player-name').textContent = bracketResp.player1;
	document.querySelector('[data-player-id="2"] .player-name').textContent = bracketResp.player2;
	document.querySelector('[data-player-id="3"] .player-name').textContent = bracketResp.player3;
	document.querySelector('[data-player-id="4"] .player-name').textContent = bracketResp.player4;
	
	
	if (status === "pending") {
	  document.querySelector('.tournament-title p:nth-child(2)').classList.remove('d-none'); 
	  document.querySelector('.eclair.match-1').classList.remove('d-none');
	} else if (status === "semifinal1_done") {
	  document.querySelector('.tournament-title p:nth-child(3)').classList.remove('d-none');
	  document.querySelector('.eclair.match-2').classList.remove('d-none');
	} else if (status === "semifinal2_done") {
	  document.querySelector('.tournament-title p:nth-child(4)').classList.remove('d-none');
	  document.querySelector('.eclair.match-3').classList.remove('d-none');
	} else if (status === "finished") {
	  document.querySelector('.tournament-title p:nth-child(5)').classList.remove('d-none');
	}
	
	
	if (winnerSemi1) {
	  document.querySelector(".winner1").classList.remove("d-none");
	  document.querySelector(".winner1 .avatar").src = playerAvatars[winnerSemi1];
	  document.querySelector(".winner1 .player-name").textContent = winnerSemi1;
	}
	
	if (winnerSemi2) {
	  document.querySelector(".winner2").classList.remove("d-none");
	  document.querySelector(".winner2 .avatar").src = playerAvatars[winnerSemi2];
	  document.querySelector(".winner2 .player-name").textContent = winnerSemi2;
	}
	
	
	if (winnerFinal) {
	  const finalWinnerElem = document.querySelector(".winner3");
	  finalWinnerElem.classList.remove("d-none");
  
	  let finalAvatar = playerAvatars[winnerFinal];
	  if (!finalAvatar) {
		finalAvatar = "/static/svg/default_avatar.svg"; 
	  }
	  
	  document.querySelector(".winner3 .avatar").src = finalAvatar;
	  document.querySelector(".winner3 .winner-name").textContent = winnerFinal;
	}
  }

async function createTournamentGameSession(tournamentId, nextMatchType) {
  try {
    const formData = new FormData();
    formData.set('next_match_type', nextMatchType);

    const response = await requestPost(
      'game',
      `create_tournament_game_session/${tournamentId}`,
      formData
    );
    if (response.status === 'success') {
      updateHtmlContent("#content", response.html);
      return response.game_id; 
    } else {
      return null;
    }
  } catch (err) {
    return null;
  }
}



function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}