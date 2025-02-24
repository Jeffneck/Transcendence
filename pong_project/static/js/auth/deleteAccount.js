"use strict";
import { requestPost } from '../api/index.js';
import { clearSessionAndUI, showStatusMessage } from '../tools/index.js';

/**
 * Affiche le modal de suppression de compte et retourne sa référence.
 * @param {string} modalId - L'ID du modal à afficher.
 * @returns {HTMLElement} Le modal affiché.
 * @throws {Error} Si le modal n'est pas trouvé.
 */
function showModal(modalId) {
  const modal = document.getElementById(modalId);
  if (!modal) {
    throw new Error(`Le modal "${modalId}" est introuvable.`);
  }
  modal.style.display = 'flex';
  return modal;
}

/**
 * Attache les événements pour fermer le modal :
 * - Clic sur le bouton de fermeture
 * - Clic en dehors du contenu du modal
 * Lors de la fermeture, l'utilisateur est redirigé vers la page précédente.
 * @param {HTMLElement} modal - Le modal concerné.
 */
function attachModalCloseEvents(modal) {
  const closeBtn = modal.querySelector('.close-btn');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      modal.style.display = 'none';
      window.history.back();
    });
  }
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.style.display = 'none';
      window.history.back();
    }
  });
}

/**
 * Envoie la requête de suppression du compte via POST et, en cas de succès,
 * affiche un message et nettoie la session après 1,5 seconde.
 * @param {HTMLFormElement} form - Le formulaire de suppression.
 */
async function submitDeleteAccount(form) {
  try {
    const formData = new FormData(form);
    const response = await requestPost('accounts', 'profile/delete_account', formData);
    if (response.status !== 'success') {
      throw new Error(response.message || 'Erreur lors de la suppression du compte.');
    }
    showStatusMessage('Votre compte a été supprimé avec succès.', 'success');
    setTimeout(clearSessionAndUI, 1500);
  } catch (error) {
    console.error('Erreur dans submitDeleteAccount:', error);
    showStatusMessage('Une erreur est survenue lors de la suppression.', 'error');
  }
}

/**
 * Gère l'affichage et la logique de suppression de compte.
 * Charge la vue, attache les événements et gère la soumission du formulaire.
 */
export async function handleDeleteAccount() {
  try {
    console.debug('Chargement de la vue de suppression...');
    const modal = showModal('delete-account-modal');
    attachModalCloseEvents(modal);

    const deleteAccountForm = document.getElementById('delete-account-form');
    if (!deleteAccountForm) {
      throw new Error('Formulaire de suppression introuvable.');
    }
    deleteAccountForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      await submitDeleteAccount(deleteAccountForm);
    });
  } catch (error) {
    console.error('Erreur dans handleDeleteAccount:', error);
    showStatusMessage(error, 'error');
  }
}
