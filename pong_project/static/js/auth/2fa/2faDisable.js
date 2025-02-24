"use strict";

import { requestGet, requestPost } from '/static/js/api/index.js';
import { updateHtmlContent, showStatusMessage } from '/static/js/tools/index.js';
import { navigateTo } from '/static/js/router.js';

async function loadDisable2FAView() {
  try {
    const response = await requestGet('accounts', '2fa/disable');
    if (response.status === 'success' && response.html) {
      updateHtmlContent('#content', response.html);
      attachDisable2FAEvent();
      return true;
    } else {
      showStatusMessage(response.message || 'Erreur lors du chargement de la vue disable 2FA.', 'error');
      return false;
    }
  } catch (error) {
    showStatusMessage('Impossible de charger la vue de désactivation de la 2FA.', 'error');
    throw error;
  }
}

async function submitDisable2FA(form) {
  const formData = new FormData(form);
  try {
    const response = await requestPost('accounts', '2fa/disable', formData);
    if (response.status === 'success') {
      showStatusMessage('La 2FA a été désactivée avec succès.', 'success');
      setTimeout(() => {
        navigateTo('/account');
      }, 1000);
    } else {
      showStatusMessage(response.message || 'Échec de la désactivation de la 2FA.', 'error');
    }
  } catch (error) {
    showStatusMessage('Erreur lors de la désactivation de la 2FA.', 'error');
  }
}

function attachDisable2FAEvent() {
  const disableForm = document.getElementById('disable-2fa-form');
  if (disableForm) {
    disableForm.addEventListener('submit', (e) => {
      e.preventDefault();
      submitDisable2FA(disableForm);
    });
  } else {
    showStatusMessage("Formulaire de désactivation introuvable.", 'error');
  }
}

export async function handleDisable2FA() {
  try {
    await loadDisable2FAView();
  } catch (error) {
    showStatusMessage('Erreur lors de la désactivation de la 2FA.', 'error');
  }
}
