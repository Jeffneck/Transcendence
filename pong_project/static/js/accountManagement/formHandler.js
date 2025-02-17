"use strict";
import { requestPost } from '../api/index.js';
import { navigateTo } from '../router.js';
import { showStatusMessage } from '../tools/displayInfo.js';
import { attachProfileEvents } from './events.js';
import { handleNavbar } from '../navbar/index.js';
import { handleLogout } from '../auth/logout.js';

async function handleFormSubmit(form, app, view, successMessage, successSelector) {
  const formData = new FormData(form);
  try {
    const response = await requestPost(app, view, formData);
    if (response.status === 'success') {
      const successElem = document.querySelector(successSelector);
      if (successElem) {
        successElem.textContent = successMessage;
        successElem.style.display = 'block';
        setTimeout(() => { successElem.style.display = 'none'; }, 3000);
      }
      form.reset();
      // Pour le changement de pseudo, on force la déconnexion
      if (successSelector === '#change-username-success') {
        await handleLogout();
        return;
      } else if (successSelector === '#change-avatar-success') {
        await handleNavbar();
      }
      navigateTo('/account');
    } else {
      showStatusMessage(response.message, "error");
    }
  } catch (error) {
    console.error(`Erreur lors de la requête vers ${app}/${view}:`, error);
    showStatusMessage(error.message || "Erreur lors de la soumission.", "error");
  }
}

export function initializeaccountsManagementFormHandlers() {
  document.querySelectorAll('form').forEach((form) => {
    if (!form.hasAttribute('data-handled')) {
      form.addEventListener('submit', async function (e) {
        e.preventDefault();
        switch (form.id) {
          case 'change-username-form':
            await handleFormSubmit(form, 'accounts', 'profile/update', 'Pseudo mis à jour!', '#change-username-success');
            break;
          case 'change-password-form':
            await handleFormSubmit(form, 'accounts', 'profile/change_password', 'Mot de passe mis à jour!', '#change-password-success');
            break;
          case 'change-avatar-form':
            await handleFormSubmit(form, 'accounts', 'profile/update_avatar', 'Avatar mis à jour!', '#change-avatar-success');
            break;
          // La suppression de compte est gérée via une modale et un module spécifique.
          default:
            console.warn('Formulaire non reconnu:', form.id);
        }
      });
      form.setAttribute('data-handled', 'true');
    }
  });
  attachProfileEvents();
}
