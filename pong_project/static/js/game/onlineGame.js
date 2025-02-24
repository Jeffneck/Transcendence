import { requestGet, requestPost } from "../api/index.js";
import { updateHtmlContent } from "../tools/index.js";
import { showStatusMessage } from "../tools/index.js";
import { isTouchDevice } from "../tools/index.js";
import { initializeGameControls } from "./controls.js";
import { launchLiveGameWithOptions } from "./live_game.js";
import { HTTPError } from "../api/index.js";
import { showResults } from "./gameResults.js";
import { navigateTo } from "../router.js";

export async function createGameOnline() {
    
    if (typeof localStorage !== "undefined" && !localStorage.getItem('access_token')) {
		navigateTo('/game-options');
		return;
	}
    let onlineParams = sessionStorage.getItem('params');
	if (onlineParams === null)
	{
		showStatusMessage("Paramètres online invalides.", 'error');
		navigateTo('/game-options');
		return;
	}
	try {
		onlineParams = JSON.parse(onlineParams);
	} catch (e) {
		showStatusMessage("Erreur lors de la recuperation des Paramètres.", 'error'); 
		return;
	}

    const formData = new FormData();
    if (onlineParams) {
        formData.append('ball_speed',               onlineParams.ball_speed);
        formData.append('paddle_size',             onlineParams.paddle_size);
        formData.append('bonus_enabled',  onlineParams.bonus_enabled);
        formData.append('obstacles_enabled',      onlineParams.obstacles_enabled);
    } else {
       showStatusMessage('Paramètres de jeu manquants.', 'error');
    }
    try {
        const response = await requestPost('game', 'create_game_online', formData);
        if (response.status === 'error') {

            showStatusMessage(response.message, 'error');
        } else {
            updateHtmlContent('#content', response.html);
            initializeFriendInvitationBtn(response.game_id);
           
        }
    } catch (error) {
            showStatusMessage('Une erreur est survenue.', 'error');
    }
}


async function sendInvitation(button, game_id) {
    const friendUsername = button.closest('li')?.getAttribute('data-username');
    if (!friendUsername) {
        return;
    }

    const formData = new FormData();
    formData.append('friend_username', friendUsername);
    formData.append('session_id', game_id);

    try {
        const response = await requestPost('game', 'send_gameSession_invitation', formData);
        if (response.status === 'success') {
            checkGameInvitationStatus(response);
        } else {
            throw new Error(response.message || 'Erreur inconnue');
        }
    } catch (error) {
        button.textContent = 'Erreur';
        button.classList.add('error');
        setTimeout(() => {
            button.innerHTML = 'Inviter <span class="cancel-icon d-none">&times;</span>';
            button.classList.remove('error');
        }, 3000);
    }
}


async function checkGameInvitationStatus(response) {
    
    updateHtmlContent('#content', response.html);
    if (isTouchDevice()) {
        initializeGameControls('touch');
    } else {
        initializeGameControls('keyboard');
    }

    
    const invitationId = response.invitation_id;  

    
    const intervalDelay = 3000; 
    let handled = false; 

    let pollInterval = setInterval(async () => {
        try {
            const data = await requestGet('game', `check_invitation_status/${invitationId}`);

            if (data.status === 'success') {
                
                if (!handled) {
                    switch (data.invitation_status) {
                        case 'pending':
                            
                            break;

                        case 'accepted':
                            handled = true;
                            clearInterval(pollInterval);
                            
                            joinOnlineGameAsLeft(data.session_id);
                            break;

                        case 'rejected':
                            handled = true;
                            clearInterval(pollInterval);
                            showStatusMessage('Invitation refusée.', 'error');
                            createGameOnline();
                            break;

                        case 'expired':
                            handled = true;
                            clearInterval(pollInterval);
                            showStatusMessage('Invitation expirée.', 'error');
                            createGameOnline();
                            break;

                        default:
                            break;
                    }
                }
            } else {
                clearInterval(pollInterval);
            }
        } catch (err) {
            clearInterval(pollInterval);
        }
    }, intervalDelay);
}



let currentFriendInvitationHandler = null;

function initializeFriendInvitationBtn(game_id) {
    
    if (currentFriendInvitationHandler !== null) {
        document.removeEventListener('click', currentFriendInvitationHandler);
    }

    
    const handler = async (event) => {
        const btn = event.target.closest('.invite-button');
        if (!btn) return;

        
        if (event.target.classList.contains('cancel-icon')) {
            event.stopPropagation();
            await cancelInvitation(btn);
            return;
        }

        
        if (!btn.classList.contains('sent')) {
            await sendInvitation(btn, game_id);
        }
    };

    
    document.addEventListener('click', handler);
    currentFriendInvitationHandler = handler;
}

async function joinOnlineGameAsLeft(game_id){
    try {
        const tactile = isTouchDevice();
        
        
        const formData = new FormData();
        formData.append('is_touch', tactile);

        
        const url = `join_online_game_as_left/${game_id}`;

        const response = await requestPost('game', url, formData);
        if (response.status === 'success') {

            updateHtmlContent('#content', response.html);
            
            await launchLiveGameWithOptions(game_id, 'left', `start_online_game/${game_id}`); 
            
            
            await new Promise(resolve => setTimeout(resolve, 2000));

            const statusResponse = await requestGet('game', `get_game_status/${game_id}`);
            if (statusResponse.status === 'success' && statusResponse.session_status === 'cancelled') {
                showStatusMessage('Un des joueurs s\'est deconnecte, partie annulee ...', 'error');
                navigateTo('/game-options');
                return;
            }
            if (statusResponse.status === 'error' ) {
                showStatusMessage('Vous avez ete deconnecte de la partie en ligne', 'error');
                navigateTo('/game-options');
                return;
            }
            await showResults(game_id);
        } else {
            showStatusMessage(response.message, 'error');
        }
    } catch (error) {
        if (error instanceof HTTPError) {
            showStatusMessage(error.message, 'error');
        } else {
            showStatusMessage('Une erreur est survenue.', 'error');
        }
    }
    
}

async function joinOnlineGameAsRight(game_id){
    try {
        const tactile = isTouchDevice();
        
        
        const formData = new FormData();
        formData.append('is_touch', tactile);

        
        const url = `join_online_game_as_right/${game_id}`;

        const response = await requestPost('game', url, formData);
        if (response.status === 'success') {

            updateHtmlContent('#content', response.html);
            
            await launchLiveGameWithOptions(game_id, 'right', `start_online_game/${game_id}`); 
            
            
            await new Promise(resolve => setTimeout(resolve, 1000));

            const statusResponse = await requestGet('game', `get_game_status/${game_id}`);
            if (statusResponse.status === 'success' && statusResponse.session_status === 'cancelled') {
                showStatusMessage('Un des joueurs s\'est deconnecte, partie annulee ...', 'error');
                navigateTo('/game-options');
                return;
            }
            if (statusResponse.status === 'error' ) {
                showStatusMessage('Vous avez ete deconnecte de la partie en ligne', 'error');
                navigateTo('/game-options');
                return;
            }
            await showResults(game_id);
        } else {
            showStatusMessage(response.message, 'error');
        }
    } catch (error) {
        if (error instanceof HTTPError) {
            showStatusMessage(error.message, 'error');
        } else {
            showStatusMessage('Une erreur est survenue.', 'error');
        }
    }
    
}


export async function acceptGameInvitation(invitationId, action) {
    try {
        if (action === 'accept') {
            const url = `accept_game_invitation/${invitationId}`;
            const response = await requestPost('game', url, null);

            if (response.status === 'success') {

                
                document.querySelector(`[data-invitation-id="${invitationId}"]`)
                    ?.closest('.invitation-item')
                    ?.remove();

                
                joinOnlineGameAsRight(response.session.id);
            }
        } else if (action === 'decline') {
            await declineGameInvitation(invitationId);
            return;
        }
    } catch (error) {}
    
}



export async function declineGameInvitation(invitationId) {
    try {
        const formData = new FormData();
        formData.append('invitation_id', invitationId);
        formData.append('action', 'decline');

        const url = `reject_game_invitation/${invitationId}`;
        const response = await requestPost('game', url, formData);

        if (response.status === 'success') {
            document.querySelector(`[data-invitation-id="${invitationId}"]`)
                ?.closest('.invitation-item')
                ?.remove();
        }
    } catch (error) {}
}