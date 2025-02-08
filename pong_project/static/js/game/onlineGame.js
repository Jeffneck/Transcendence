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
    //console.log('[sendInvitation] Envoi de l\'invitation...');
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

// Lancée pour le joueur left après qu'il ait fait sendInvitation()
// Check le statut de l'invitation envoyée toutes les 3 secondes 
// Pendant que le joueur est sur la page loading.html
// redirige vers joinOnlineGameAsLeft() quand l'autre joueur a accepté l'invitation
async function checkGameInvitationStatus(response) {
    // 1) On met à jour le contenu HTML et on initialise les contrôles (comme tu le fais déjà)
    updateHtmlContent('#content', response.html);

    if (isTouchDevice()) {
        initializeGameControls('touch');
    } else {
        initializeGameControls('keyboard');
    }

    // 2) On récupère l'ID de l'invitation depuis la réponse 
    //    (assure-toi que ton backend t'envoie bien `invitation_id` dans `response`)
    const invitationId = response.invitation_id;  

    // 3) On définit l'interval pour faire un GET sur CheckGameInvitationStatusView
    const intervalDelay = 3000; // en ms, par ex. toutes les 3 secondes
    let pollInterval = setInterval(async () => {
        try {
            const data = await requestGet('game', `check_invitation_status/${invitationId}`);
            // Gérer la réponse
            if (data.status === 'success') {
                
              // Vérifier data.status (succès) et data.invitation_status (pending, accepted, etc.)
                if (data.status === 'success') {
                    // data.invitation_status => 'pending', 'accepted', 'rejected', 'expired'
                    switch (data.invitation_status) {
                        case 'pending':
                            // On ne fait rien, on attend le prochain interval
                            //console.log("Invitation toujours en attente...");
                            break;

                        case 'accepted':
                            //console.log("Invitation acceptée !");
                            // 1) Arrêter le polling
                            clearInterval(pollInterval);

                            // 2) Rediriger vers la page de jeu
                            joinOnlineGameAsLeft(data.session_id);
                            break;

                        case 'rejected':
                            clearInterval(pollInterval);
                            showStatusMessage('Invitation refusée.', 'error');
                            createGameOnline();
                            break;
                        case 'expired':
                            clearInterval(pollInterval);
                            showStatusMessage('Invitation expirée.', 'error');
                            createGameOnline();
                            break;
                        default:
                            console.warn("Statut inconnu :", data.invitation_status);
                            break;
                    }
                } else {
                    // Gérer data.status = 'error'
                    console.error("Erreur lors de la vérification :", data.message);
                    clearInterval(pollInterval);
                }
            } else {
                // Statut HTTP non 200 => on arrête tout
                console.error("Échec de la requête GET sur check_invitation_status :", statusResponse.status);
                clearInterval(pollInterval);
            }
        } catch (err) {
            console.error("Erreur réseau/JS pendant le polling:", err);
            clearInterval(pollInterval);
        }
    }, intervalDelay); 
}


function initializeFriendInvitationBtn(game_id) {
    document.addEventListener('click', async (event) => {
        const btn = event.target.closest('.invite-button');
        if (!btn) return;

        if (event.target.classList.contains('cancel-icon')) {
            event.stopPropagation();
            await cancelInvitation(btn);
            return;
        }

        // Si pas déjà envoyé
        if (!btn.classList.contains('sent')) {
            await sendInvitation(btn, game_id);
        }
    });
}

async function joinOnlineGameAsLeft(game_id){
    try {
        const tactile = isTouchDevice();
        //console.log('tactile :', tactile);
        
        // Créez un FormData et ajoutez le paramètre is_touch
        const formData = new FormData();
        formData.append('is_touch', tactile);

        // Construit l'URL sans query string
        const url = `join_online_game_as_left/${game_id}`;

        const response = await requestPost('game', url, formData);
        if (response.status === 'success') {

            updateHtmlContent('#content', response.html);
            
            await launchLiveGameWithOptions(game_id, 'left', `start_online_game/${game_id}`);
            const statusResponse = await requestGet('game', `get_game_status/${game_id}`);
            if (statusResponse.status === 'success' && statusResponse.session_status === 'cancelled') {
                showStatusMessage('Un des joueurs s\'est deconnecte, partie annulee ...', 'error');
                return
            }
            if (statusResponse.status === 'error' ) {
                showStatusMessage('Vous avez ete deconnecte de la partie en ligne', 'error');
                return
            }
            await showResults(game_id);
            
            //IMPROVE afficher une page présentant le winner et looser une fois la game terminee
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