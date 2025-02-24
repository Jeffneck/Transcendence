"use strict";
import { clearSessionAndUI, showStatusMessage } from '../tools/index.js';
import { requestPost } from '../api/index.js';

async function logoutUser() {
  const formData = new FormData();
  const refreshToken = localStorage.getItem('refresh_token');
  if (!refreshToken) {
    throw new Error('Aucun refresh token trouvé.');
  }
  formData.append('refresh_token', refreshToken);
  const response = await requestPost('accounts', 'logout', formData);
  if (response.status !== 'success') {
    throw new Error(response.error || 'La déconnexion a échoué côté serveur.');
  }
  return response;
}

export async function handleLogout() {
  try {
    await logoutUser();
    showStatusMessage('Déconnexion réussie.', 'success');
    setTimeout(() => { clearSessionAndUI(); }, 1000);
  } catch (error) {
    showStatusMessage('La déconnexion a échoué. Veuillez réessayer.', 'error');
  }
}
