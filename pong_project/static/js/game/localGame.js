import { requestGet, requestPost } from "../api/index.js";
import { updateHtmlContent } from "../tools/index.js";
import { showStatusMessage } from "../tools/index.js";
import { launchLiveGameWithOptions } from "./live_game.js";
import { showResults } from "./gameResults.js";




export async function handleLocalGame(parametersForm) {
    try {

        const response = await requestPost('game', 'create_local_game', parametersForm);
        if (response.status === 'success') {
            showStatusMessage(`Partie créée avec succès : ID = ${response.game_id}`, 'success');
			updateHtmlContent('#content', response.html);
            const gameId = response.game_id;
            await launchLiveGameWithOptions(gameId, 'both', `start_local_game/${gameId}`);
            // on vérifie le status côté serveur avant d'afficher le scoreboard:
            const statusResponse = await requestGet('game', `get_game_status/${gameId}`);
            if (statusResponse.status === 'success' && statusResponse.session_status === 'finished') {
                // => la partie est finie normalement => on appelle showResults
                await showResults(gameId);
                return;
            }
            else if (statusResponse.status === 'success' && statusResponse.session_status === 'cancelled') {
                showStatusMessage('Un des joueurs s\'est deconnecte, partie annulee ...', 'error');
            }
        } else {
            showStatusMessage(response.message, 'error');
        }
    } catch (err) {
        console.error('Error local game', err);
        showStatusMessage(err.message, 'error');
    }
}