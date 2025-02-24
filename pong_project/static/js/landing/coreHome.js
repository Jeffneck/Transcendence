"use strict";
import { requestGet } from '../api/index.js';
import { HTTPError } from '../api/index.js';
import { updateHtmlContent, showStatusMessage } from '../tools/index.js';
import { navigateTo } from '../router.js';

function attachNavigationEvents() {
  const loginBtn = document.querySelector('#login-btn');
  if (loginBtn) {
    loginBtn.addEventListener('click', (e) => {
      e.preventDefault();
      navigateTo('/login');
    });
  }
  const registerBtn = document.querySelector('#register-btn');
  if (registerBtn) {
    registerBtn.addEventListener('click', (e) => {
      e.preventDefault();
      navigateTo('/register');
    });
  }
}

export async function initializeHomeView() {
  try {
    const data = await requestGet('core', 'home');
    if (data && data.html) {
      updateHtmlContent('#content', data.html);
    } else {
      showStatusMessage("Impossible de charger la page d'accueil.", 'error');
      return;
    }
  } catch (error) {
    if (error instanceof HTTPError && error.status === 403) {
      showStatusMessage('Vous êtes déjà connecté. Redirection...', 'error');
      navigateTo('/home');
      return;
    } else {
      showStatusMessage("Erreur lors du chargement de la page d'accueil.", 'error');
    }
  }
  attachNavigationEvents();
}
