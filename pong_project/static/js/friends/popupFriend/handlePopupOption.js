"use strict";
import { handleRemoveFriend } from '../index.js';
import { navigateTo } from '../../router.js';
import { showStatusMessage } from '../../tools/index.js';

/**
 * Gère l'action sélectionnée dans le popup d'options pour un ami.
 *
 * @param {string} option - L'option sélectionnée (ex. "Voir le profil", "Supprimer").
 */
export function handleOptionPopup(option) {
  const friendNameElement = document.getElementById('popupFriendName');
  if (!friendNameElement) {
    showStatusMessage("Nom d'ami introuvable.", 'error');
    return;
  }
  
  const friendName = friendNameElement.innerText.trim();
  
  switch (option) {
    case 'Voir le profil': {
      const encodedName = encodeURIComponent(friendName);
      navigateTo(`/profile/${encodedName}`);
      break;
    }
    case 'Supprimer':
      handleRemoveFriend(friendName);
      break;
    default:
      showStatusMessage(`Option inconnue: ${option}`, 'error');
  }
}
