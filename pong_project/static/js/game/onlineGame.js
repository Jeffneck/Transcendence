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
		navigateTo('/');
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
		showStatusMessage("Erreur lors de la recuperation des Paramètres.", 'error'); //[IMPROVE]
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
        //console.log('Avant le try');
        const response = await requestPost('game', 'create_game_online', formData);
        //console.log('requestPost effectué'); 
        if (response.status === 'error') {
            //console.log('requestPost error'); 

            showStatusMessage(response.message, 'error');
        } else {
            updateHtmlContent('#content', response.html);
            initializeFriendInvitationBtn(response.game_id);
        }
    } catch (error) {
            showStatusMessage('Une erreur est survenue.', 'error');
            console.error('Erreur createGameOnline :', error);
    }
}


async function sendInvitation(button, game_id) {
    console.log('[sendInvitation] Envoi de l\'invitation...');
    console.log('game_id :', game_id);
    const friendUsername = button.closest('li')?.getAttribute('data-username');
    if (!friendUsername) {
        console.error('Nom d\'utilisateur introuvable.');
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
        console.error('Erreur lors de l\'envoi :', error);
        button.textContent = 'Erreur';
        button.classList.add('error');
        setTimeout(() => {
            button.innerHTML = 'Inviter <span class="cancel-icon d-none">&times;</span>';
            button.classList.remove('error');
        }, 3000);
    }
}


async function checkGameInvitationStatus(response) {
    // 1) Met à jour le contenu HTML et initialise les contrôles
    updateHtmlContent('#content', response.html);
    if (isTouchDevice()) {
        initializeGameControls('touch');
    } else {
        initializeGameControls('keyboard');
    }

    // 2) Récupère l'ID de l'invitation depuis la réponse
    const invitationId = response.invitation_id;  

    // 3) Définition du délai d'intervalle et initialisation du flag de traitement
    const intervalDelay = 3000; // toutes les 3 secondes
    let handled = false; // S'assure que le traitement terminal (accepted, rejected, expired) s'exécute une seule fois

    let pollInterval = setInterval(async () => {
        try {
            const data = await requestGet('game', `check_invitation_status/${invitationId}`);

            if (data.status === 'success') {
                // On traite uniquement si la réponse n'a pas encore été gérée
                if (!handled) {
                    switch (data.invitation_status) {
                        case 'pending':
                            // Invitation toujours en attente, on attend la prochaine itération
                            break;

                        case 'accepted':
                            handled = true;
                            clearInterval(pollInterval);
                            // Redirige vers la session de jeu pour le joueur de gauche
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
                            console.warn("Statut inconnu :", data.invitation_status);
                            break;
                    }
                }
            } else {
                console.error("Erreur lors de la vérification :", data.message);
                clearInterval(pollInterval);
            }
        } catch (err) {
            console.error("Erreur réseau/JS pendant le polling:", err);
            clearInterval(pollInterval);
        }
    }, intervalDelay);
}


// Variable globale pour stocker la référence au gestionnaire d'événement actuel
let currentFriendInvitationHandler = null;

function initializeFriendInvitationBtn(game_id) {
    // Si un gestionnaire est déjà attaché, le retirer
    if (currentFriendInvitationHandler !== null) {
        document.removeEventListener('click', currentFriendInvitationHandler);
    }

    // Définir le nouveau gestionnaire avec le game_id actuel
    const handler = async (event) => {
        const btn = event.target.closest('.invite-button');
        if (!btn) return;

        // Si l'utilisateur clique sur l'icône d'annulation, gérer l'annulation
        if (event.target.classList.contains('cancel-icon')) {
            event.stopPropagation();
            await cancelInvitation(btn);
            return;
        }

        // Si l'invitation n'a pas encore été envoyée
        if (!btn.classList.contains('sent')) {
            await sendInvitation(btn, game_id);
        }
    };

    // Attacher le nouveau gestionnaire et enregistrer sa référence
    document.addEventListener('click', handler);
    currentFriendInvitationHandler = handler;
}

async function joinOnlineGameAsLeft(game_id){
    try {
        const tactile = isTouchDevice();
        
        // Créez un FormData et ajoutez le paramètre is_touch
        const formData = new FormData();
        formData.append('is_touch', tactile);

        // Construit l'URL sans query string
        const url = `join_online_game_as_left/${game_id}`;

        const response = await requestPost('game', url, formData);
        if (response.status === 'success') {

            updateHtmlContent('#content', response.html);
            
            await launchLiveGameWithOptions(game_id, 'left', `start_online_game/${game_id}`); // Boucle de jeu
            
            // Ajout d'une pause de 1 seconde
            await new Promise(resolve => setTimeout(resolve, 1000));

            const statusResponse = await requestGet('game', `get_game_status/${game_id}`);
            if (statusResponse.status === 'success' && statusResponse.session_status === 'cancelled') {
                showStatusMessage('Un des joueurs s\'est deconnecte, partie annulee ...', 'error');
                return;
            }
            if (statusResponse.status === 'error' ) {
                showStatusMessage('Vous avez ete deconnecte de la partie en ligne', 'error');
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
        console.error('Erreur joinOnlineGameAsLeft :', error);
    }
}


export async function acceptGameInvitation(invitationId, action) {
    try {
        if (action === 'accept') {
            const url = `accept_game_invitation/${invitationId}`;
            const response = await requestPost('game', url, null);

            if (response.status === 'success') {
                //console.log('Invitation acceptée => session créée :', response);

                // Supprime l'invitation de l'UI
                document.querySelector(`[data-invitation-id="${invitationId}"]`)
                    ?.closest('.invitation-item')
                    ?.remove();

                // Rejoindre le jeu en tant que joueur RIGHT
                joinOnlineGameAsRight(response.session.id);
            } else {
                console.error('Erreur à l\'acceptation :', response.message);
            }
        } else if (action === 'decline') {
            await declineGameInvitation(invitationId);
        }
    } catch (error) {
        console.error('Erreur réseau lors du traitement de l\'invitation :', error);
    }
}


async function joinOnlineGameAsRight(gameId) {
    try {
        const tactile = isTouchDevice();
        //console.log('tactile :', tactile);
        
        // Créez un FormData et ajoutez le paramètre is_touch
        const formData = new FormData();
        formData.append('is_touch', tactile);
        const url = `join_online_game_as_left/${gameId}`;  // Assurez-vous d'avoir le slash final si nécessaire

        // Récupérer les données pour rejoindre la partie
        const response = await requestPost('game', url, formData);

        // Gestion des erreurs renvoyées par le serveur
        if (response.status === 'error') {
            console.error("Erreur lors de la tentative de rejoindre le jeu :", response.message);
            showStatusMessage(response.message, 'error');
            return;
        }
        // Si succès, afficher la page de jeu 
        updateHtmlContent('#content', response.html);
        await launchLiveGameWithOptions(gameId, 'right', `start_online_game/${gameId}`);

        await new Promise(resolve => setTimeout(resolve, 1000));
        // on vérifie le status côté serveur avant de continuer la loop
        const statusResponse = await requestGet('game', `get_game_status/${gameId}`);
        if (statusResponse.status === 'success' && statusResponse.session_status === 'cancelled') {
            showStatusMessage('Un des joueurs s\'est deconnecte, partie annulee ...', 'error');
            return
        }
        if (statusResponse.status === 'error' ) {
            showStatusMessage('Vous avez ete deconnecte de la partie en ligne', 'error');
            return
        }
        await showResults(gameId);


    } catch (error) {
        console.error('Erreur réseau lors de la connexion au jeu en tant que joueur Right:', error);
        showStatusMessage('Une erreur réseau est survenue. Veuillez réessayer.', 'error');
    }
}

export async function declineGameInvitation(invitationId) {
    try {
        const formData = new FormData();
        formData.append('invitation_id', invitationId);
        formData.append('action', 'decline');

        const url = `reject_game_invitation/${invitationId}`;
        const response = await requestPost('game', url, formData);

        if (response.status === 'success') {
            //console.log('Invitation refusée :', response);
            document.querySelector(`[data-invitation-id="${invitationId}"]`)
                ?.closest('.invitation-item')
                ?.remove();
        } else {
            console.error('Erreur lors du refus :', response.message);
        }
    } catch (error) {
        console.error('Erreur lors du refus de l\'invitation :', error);
    }
}