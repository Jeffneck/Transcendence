"use strict";
import { clearSessionAndUI, showStatusMessage } from '../tools/index.js';
import { requestPost } from '../api/index.js';

async function logoutUser() {
  const formData = new FormData();
  const refreshToken = localStorage.getItem('refresh_token');
  if (!refreshToken) {
    const errorMsg = 'Aucun refresh token trouvé.';
    console.error(errorMsg);
    throw new Error(errorMsg);
  }
  formData.append('refresh_token', refreshToken);
  const response = await requestPost('accounts', 'logout', formData);
  if (response.status !== 'success') {
    const errorMsg = response.error || 'La déconnexion a échoué côté serveur.';
    console.error('Erreur de déconnexion:', errorMsg);
    throw new Error(errorMsg);
  }
  return response;
}

export async function handleLogout() {
  try {
    await logoutUser();
    showStatusMessage('Déconnexion réussie.', 'success');
    setTimeout(() => { clearSessionAndUI(); }, 1000);
  } catch (error) {
    console.error('Erreur lors de la déconnexion :', error);
    showStatusMessage('La déconnexion a échoué. Veuillez réessayer.', 'error');
  }
}
