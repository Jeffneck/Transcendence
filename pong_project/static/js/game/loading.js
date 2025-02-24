"use strict";
import { requestGet } from '../api/index.js';
import { isTouchDevice } from '../tools/utility.js';
import { updateHtmlContent } from '../tools/domHandler.js';
import { initializeGameControls } from './controls.js';
import { showStatusMessage } from '../tools/index.js';

/**
 * Charge la vue de chargement du jeu et initialise les contrôles en fonction du dispositif.
 *
 * @param {number} participantCount - Nombre de participants (optionnel).
 */
export async function startLoading(participantCount) {
  try {
    const response = await requestGet('game', 'loading');
    if (response && response.html) {
      updateHtmlContent('#content', response.html);
    } else {
      showStatusMessage('Données de chargement manquantes.', 'error');
      return;
    }
    const controlType = isTouchDevice() ? 'touch' : 'keyboard';
    initializeGameControls(controlType);
    // Optionnel : activer le polling ou déclencher une action après un délai si nécessaire.
  } catch (error) {
    showStatusMessage('Erreur lors du chargement du jeu. Veuillez réessayer.', 'error');
  }
}
