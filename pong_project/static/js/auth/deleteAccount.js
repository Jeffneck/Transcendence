"use strict";
import { requestPost } from '../api/index.js';
import { clearSessionAndUI, showStatusMessage } from '../tools/index.js';


function showModal(modalId) {
  const modal = document.getElementById(modalId);
  if (!modal) {
    throw new Error(`Le modal "${modalId}" est introuvable.`);
  }
  modal.style.display = 'flex';
  return modal;
}


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
    showStatusMessage('Une erreur est survenue lors de la suppression.', 'error');
  }
}


export async function handleDeleteAccount() {
  try {
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
    const errorMessage = typeof error === 'string' ? error : error.message || "Une erreur s'est produite.";
    showStatusMessage(errorMessage, 'error');
  }
}
