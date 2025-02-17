// static/js/2fa/enable2fa.js
"use strict";

import { navigateTo } from '/static/js/router.js';
import { requestGet, requestPost } from '/static/js/api/index.js';
import { updateHtmlContent, showStatusMessage } from '/static/js/tools/index.js';

async function loadEnable2FAView() {
  try {
    const response = await requestGet('accounts', '2fa/enable');
    if (response.status === 'success' && response.html) {
      updateHtmlContent('#content', response.html);
      attach2FAVerificationEvent();
      return true;
    } else {
      showStatusMessage(response.message || 'Erreur lors du chargement de la vue 2FA.', 'error');
      return false;
    }
  } catch (error) {
    console.error('Erreur lors du chargement de la vue 2FA:', error);
    showStatusMessage('Impossible de charger la vue d\'activation de la 2FA.', 'error');
    throw error;
  }
}

async function verification2FA(event) {
  event.preventDefault();
  const form = event.target;
  const formData = new FormData(form);
  try {
    const response = await requestPost('accounts', '2fa/check', formData);
    if (response.status === 'success') {
      showStatusMessage('2FA activée avec succès.', 'success');
      setTimeout(() => {
        navigateTo('/account');
      }, 1000);
    } else {
      showStatusMessage(response.message || 'Code 2FA incorrect.', 'error');
    }
  } catch (error) {
    console.error('Erreur lors de la vérification 2FA:', error);
    showStatusMessage('Erreur lors de la vérification de la 2FA.', 'error');
  }
}

function attach2FAVerificationEvent() {
  const verifyForm = document.getElementById('verify-2fa-form');
  if (verifyForm) {
    verifyForm.addEventListener('submit', verification2FA);
    console.debug('Événement de vérification 2FA attaché.');
  } else {
    console.error('Formulaire de vérification 2FA introuvable.');
    showStatusMessage('Formulaire de vérification introuvable.', 'error');
  }
}

export async function handleEnable2FA() {
  try {
    const loaded = await loadEnable2FAView();
    if (!loaded) return;
  } catch (error) {
    console.error('Erreur dans handleEnable2FA:', error);
    showStatusMessage('Erreur lors de l\'activation de la 2FA.', 'error');
  }
}
