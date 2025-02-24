"use strict";
import { requestPost } from '../api/index.js';
import { refreshBurgerMenu } from '../navbar/loadNavbar.js';
import { showStatusMessage } from '../tools/index.js';

async function updateUserStatus(status) {
  const formData = new FormData();
  formData.append('status', status);
  const response = await requestPost('accounts', 'burgerMenu/update-status', formData);
  if (response.status !== 'success') {
    throw new Error(response.message || 'Erreur inconnue.');
  }
  return response;
}

export async function handleStatusChange(status) {
  try {
    await updateUserStatus(status);
    showStatusMessage('Statut mis à jour avec succès.', 'success');
  } catch (error) {
    showStatusMessage('Impossible de mettre à jour le statut. Veuillez réessayer.', 'error');
  }
  await refreshBurgerMenu();
}
