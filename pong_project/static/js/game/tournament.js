import { requestGet, requestPost } from "../api/index.js";
import { isTouchDevice, showStatusMessage, updateHtmlContent } from "../tools/index.js";
import { launchLiveGameWithOptions } from './live_game.js';
import { TournamentNextMatch } from './tournament_utils.js';
import { showResults } from "./gameResults.js";
import { navigateTo} from "../router.js";


// Fonction principale appelée quand on clique sur "Lancer Tournoi" dans le menu
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
		showStatusMessage("Erreur lors de la recuperation des Paramètres.", 'error'); //[IMPROVE]
		return;
	}
	
		//console.log("Tournament param est égale a :", tournamentParam);
		// 1) Récupère le formulaire (GET)
	const formHtml = await getTournamentForm();
	if (!formHtml)
		return;
	updateHtmlContent('#content', formHtml);

	// 2) Sélection du form dans le DOM
	const form = document.querySelector('#content form');
	if (!form) {
		console.error("Formulaire introuvable dans le HTML injecté.");
		return;
	}

	// 3) Au submit => POST de création du tournoi
	form.addEventListener("submit", async (event) => {
		event.preventDefault();

		// Récupération des champs du form
		const formData = new FormData(form);

		// Si vous avez d’autres paramètres passés depuis un menu (tournamentParam),
		// on peut forcer/écraser ici dans le formData :
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
        // Lance la suite (loop + affichage bracket + next match etc.)
        await runTournamentFlow(response.tournament_id);
      }}
    catch (error) {
		console.error("Erreur lors de la création du tournoi :", error);
		}
	
  });
}

// -- Petites fonctions factorielles pour clarifier --

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
  // Appel POST vers /game/create_tournament
  return await requestPost('game', 'create_tournament', formData);
}

// -- Le “flow” du tournoi (récup bracket, next match, etc.) --

async function runTournamentFlow(tournamentId) {
	window.stopTournamentFlow = false; // Réinitialise au lancement du tournoi
  
	while (true) {
	  if (window.stopTournamentFlow) {
		//console.log("Flux tournoi arrêté car l'utilisateur est revenu à la Home.");
		break;
	  }
  
	  // 1) Afficher le bracket
	  const bracketResp = await requestGet('game', `tournament_bracket/${tournamentId}`);
	  if (!bracketResp || bracketResp.status !== "success" || window.stopTournamentFlow) {
		console.error("Impossible de récupérer le bracket du tournoi ou tournoi annulé.");
		break;
	  }
  
	  updateHtmlContent("#content", bracketResp.html);
	  updateBracketUI(bracketResp);
	  await delay(3000);

	  if (bracketResp.tournament_status === "finished" || window.stopTournamentFlow) {
		//console.log("Tournoi terminé ou arrêté.");
		break;
	  }
  
	  // 2) Récupérer les joueurs du prochain match
	  const nextResp = await requestGet('game', `tournament_next_game/${tournamentId}`);
	  if (!nextResp || nextResp.status !== "success" || window.stopTournamentFlow) {
		console.error("Impossible de récupérer le prochain match ou tournoi annulé.");
		break;
	  }
  
	  if (nextResp.next_match_type === "finished" || window.stopTournamentFlow) {
		//console.log("Tournoi terminé.");
		break;
	  }
  
	  updateHtmlContent("#content", nextResp.html);
	  updateNextGameUI(bracketResp, nextResp);
	  TournamentNextMatch();
	  await delay(3000);
  
	  // 3) Créer la gameSession de match
	  const gameId = await createTournamentGameSession(tournamentId, nextResp.next_match_type);
	  if (!gameId || window.stopTournamentFlow) {
		showStatusMessage('Tournoi annulé ...', 'error');
		console.error("Erreur lors de la création de la session de match ou tournoi annulé.");
		break;
	  }
  
	  // 4) Lancer le liveGame 
	  await launchLiveGameWithOptions(gameId, 'both', `start_tournament_game_session/${gameId}`);
	  
	  // Vérification du statut
	  const statusResponse = await requestGet('game', `get_game_status/${gameId}`);
	  if (statusResponse.status === 'error' || statusResponse.session_status !== 'finished' || window.stopTournamentFlow) {
		showStatusMessage('Tournoi annulé ...', 'error');
		//console.log("Tournoi annulé ou statut non terminé.");
		break;
	  }
	}
  
	sessionStorage.removeItem('tournamentparams');
	//console.log("Fin du flux tournoi");
  }


function updateNextGameUI(bracketResp, nextResp) {
	// Récupère le type de match prochain (ex. "semifinal1", "semifinal2" ou "final")
	const matchType = nextResp.next_match_type;
	
	// Variables pour le joueur de gauche (avatar1) et celui de droite (avatar2)
	let leftPlayerName = "";
	let rightPlayerName = "";
	let leftPlayerAvatar = "";
	let rightPlayerAvatar = "";
	
	// Récupère le dictionnaire des avatars envoyé par le serveur
	const avatars = bracketResp.player_avatars;
	
	// Adaptation du switch aux valeurs renvoyées par la vue
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
		// Pour le final, on utilise les gagnants des demi-finales
		leftPlayerName = bracketResp.winner_semifinal_1;
		rightPlayerName = bracketResp.winner_semifinal_2;
		leftPlayerAvatar = avatars[bracketResp.winner_semifinal_1] || "/static/svg/default_avatar.svg";
		rightPlayerAvatar = avatars[bracketResp.winner_semifinal_2] || "/static/svg/default_avatar.svg";
		break;
	  default:
		console.error("Type de match inconnu :", matchType);
		return;
	}
	
	// Mise à jour des éléments du DOM :
	// avatar1 correspond au joueur de gauche et avatar2 au joueur de droite.
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
	
	//console.log("Next match type:", matchType);
	//console.log("Gauche :", leftPlayerName, leftPlayerAvatar);
	//console.log("Droite :", rightPlayerName, rightPlayerAvatar);
  }



// Met à jour le bracket en fonction de l'état du tournoi
// Improve remplacer par des balises django dans le front ??
function updateBracketUI(bracketResp) {
	const status = bracketResp.tournament_status;
	const name = bracketResp.tournament_name;
	const winnerSemi1 = bracketResp.winner_semifinal_1;
	const winnerSemi2 = bracketResp.winner_semifinal_2;
	const winnerFinal = bracketResp.winner_final;

	//console.log("updateBracketUI status:", status, "winnerSemi1:", winnerSemi1, "winnerSemi2:", winnerSemi2, "winnerFinal:", winnerFinal);
	//console.log("updateBracketUI status: eclair ? ",document.querySelector('.eclair.match-1'));
	// Récupère le dictionnaire des avatars depuis le JSON
	const playerAvatars = bracketResp.player_avatars;
	
	// Mettez à jour le titre avec le nom du tournoi
    document.querySelector('.title-choosen').textContent = name

	// Masque tous les paragraphes d'état
	document.querySelectorAll('.tournament-title p').forEach(p => p.classList.add('d-none'));
	
	// Mise à jour des avatars et noms pour chaque joueur
	document.querySelector('[data-player-id="1"] .avatar').src = playerAvatars[bracketResp.player1];
	document.querySelector('[data-player-id="2"] .avatar').src = playerAvatars[bracketResp.player2];
	document.querySelector('[data-player-id="3"] .avatar').src = playerAvatars[bracketResp.player3];
	document.querySelector('[data-player-id="4"] .avatar').src = playerAvatars[bracketResp.player4];
	
	document.querySelector('[data-player-id="1"] .player-name').textContent = bracketResp.player1;
	document.querySelector('[data-player-id="2"] .player-name').textContent = bracketResp.player2;
	document.querySelector('[data-player-id="3"] .player-name').textContent = bracketResp.player3;
	document.querySelector('[data-player-id="4"] .player-name').textContent = bracketResp.player4;
	
	// Affichage contextuel selon l'état du tournoi
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
	
	// Affichage des gagnants des demi-finales
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
	
	// Affichage du final
	if (winnerFinal) {
	  const finalWinnerElem = document.querySelector(".winner3");
	  finalWinnerElem.classList.remove("d-none");
  
	  let finalAvatar = playerAvatars[winnerFinal];
	  if (!finalAvatar) {
		console.error("Avatar introuvable pour le final winner:", winnerFinal);
		finalAvatar = "/static/svg/default_avatar.svg"; // Avatar par défaut
	  } else {
		//console.log("Final winner:", winnerFinal, "Avatar URL:", finalAvatar);
	  }
	  
	  document.querySelector(".winner3 .avatar").src = finalAvatar;
	  document.querySelector(".winner3 .winner-name").textContent = winnerFinal;
	}
  }
// Création de la session (POST vers /game/create_tournament_game_session/<tournament_id>)
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
      return response.game_id; // On retourne juste l’ID
    } else {
      console.error("createTournamentGameSession error:", response.message);
      return null;
    }
  } catch (err) {
    console.error("createTournamentGameSession exception:", err);
    return null;
  }
}


// Petit utilitaire de pause asynchrone
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}