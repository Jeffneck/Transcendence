"use strict";
import { requestPost } from '../../api/index.js';
import { showStatusMessage } from '../../tools/index.js';

/**
 * Envoie une requête pour supprimer un ami.
 *
 * @param {string} friendName - Le nom de l'ami à supprimer.
 * @returns {Promise<Object>} La réponse de l'API.
 * @throws {Error} Si la suppression échoue.
 */
async function removeFriend(friendName) {
  const formData = new FormData();
  formData.append('friend_username', friendName);
  
  const response = await requestPost('accounts', 'friends/remove', formData);
  if (!response || response.status !== 'success') {
    const errorMessage = response?.message || "Erreur lors de la suppression de l'ami.";
    throw new Error(errorMessage);
  }
  return response;
}

/**
 * Gère la suppression d'un ami en appelant la requête et en mettant à jour l'interface.
 * @param {string} friendName - Le nom de l'ami à supprimer.
 */
export async function handleRemoveFriend(friendName) {
  try {
    const response = await removeFriend(friendName);
    // Mise à jour de l'interface : suppression de l'élément DOM associé à l'ami supprimé.
    document.querySelectorAll('.friend-btn').forEach(button => {
      if (button.textContent.includes(friendName)) {
        button.closest('.friend-item')?.remove();
      }
    });
    showStatusMessage(response.message || "Ami supprimé avec succès.", "success");
  } catch (error) {
    showStatusMessage(error?.message || "Erreur lors de la suppression de l'ami.", "error");
  }
}
