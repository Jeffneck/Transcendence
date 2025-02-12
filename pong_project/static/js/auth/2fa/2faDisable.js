// static/js/2fa/disable2fa.js

// [ IMPROVE] Supprimer la modale suppression de compte


"use strict";

import { requestPost } from '/static/js/api/index.js';
import { showStatusMessage } from '/static/js/tools/index.js';
import { navigateTo } from '/static/js/router.js';

async function submitDisable2FA(form) {
  const formData = new FormData(form);
  try {
    const response = await requestPost('accounts', '2fa/disable', formData);
    if (response.status === 'success') {
      showStatusMessage('La 2FA a été désactivée avec succès.', 'success');
      setTimeout(() => {
        navigateTo('/account');
      }, 2000);
    } else {
      showStatusMessage(response.message || 'Échec de la désactivation de la 2FA.', 'error');
    }
  } catch (error) {
    console.error('Erreur dans submitDisable2FA:', error);
    showStatusMessage('Erreur lors de la désactivation de la 2FA.', 'error');
  }
}

function attachDisable2FAEvent() {
  const modal = document.getElementById('delete-account-modal');
  if (!modal) {
    console.error('Modale de désactivation introuvable.');
    showStatusMessage('Modale de désactivation introuvable.', 'error');
    return;
  }
  const closeBtn = modal.querySelector('.close-btn');
  const disableForm = document.getElementById('disable-2fa-form');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => { modal.style.display = 'none'; });
  }
  window.addEventListener('click', (e) => {
    if (e.target === modal) modal.style.display = 'none';
  });
  if (disableForm) {
    disableForm.addEventListener('submit', (e) => {
      e.preventDefault();
      submitDisable2FA(disableForm);
    });
  } else {
    console.error("Formulaire de désactivation introuvable.");
    showStatusMessage("Formulaire de désactivation introuvable.", 'error');
  }
}

export async function handleDisable2FA() {
  try {
    const modal = document.getElementById('delete-account-modal');
    if (!modal) {
      throw new Error('Modale de désactivation introuvable.');
    }
    modal.style.display = 'flex';
    attachDisable2FAEvent();
  } catch (error) {
    console.error('Erreur dans handleDisable2FA:', error);
    showStatusMessage('Erreur lors de la désactivation.', 'error');
  }
}
