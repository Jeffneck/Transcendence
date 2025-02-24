"use strict";
import { showStatusMessage } from '../tools/index.js';
import { requestPost } from '../api/index.js';
import { navigateTo } from '../router.js';

async function handleLanguageChange(language) {
  try {
    const formData = new FormData();
    formData.append('language', language);
    const data = await requestPost('accounts', 'set_language', formData);
    if (data.status === 'success') {
      location.reload(); // Recharge la page pour appliquer la langue
    } else {
      showStatusMessage(`Erreur lors du changement de langue : ${data.message}`, 'error');
    }
  } catch (error) {
    showStatusMessage("Une erreur est survenue lors du changement de langue. Veuillez réessayer.", 'error');
    // Vous pouvez également logger l'erreur en interne si nécessaire
  }
}

export function attachProfileEvents() {
  const bindEvent = (selector, callback) => {
    const element = document.querySelector(selector);
    if (element && !element.dataset.bound) {
      element.addEventListener('click', callback);
      element.dataset.bound = true;
    }
  };

  // Boutons de navigation
  bindEvent('#enable-2fa-btn', () => navigateTo('/enable-2fa'));
  bindEvent('#disable-2fa-btn', () => navigateTo('/disable-2fa'));
  bindEvent('#delete-account-btn', () => navigateTo('/delete-account'));

  // Boutons de langue
  document.querySelectorAll('button[data-lang]').forEach((button) => {
    if (!button.dataset.bound) {
      button.addEventListener('click', (event) => {
        event.preventDefault();
        handleLanguageChange(button.dataset.lang);
      });
      button.dataset.bound = true;
    }
  });
}
