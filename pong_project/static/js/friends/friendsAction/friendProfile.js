"use strict";
import { requestGet } from '../../api/index.js';
import { updateHtmlContent, showStatusMessage } from '../../tools/index.js';

async function loadFriendProfile(friendName) {
  try {
    const response = await requestGet('accounts', `friend/${friendName}`);
    if (!response) return;
    if (response.status !== 'success') {
      throw new Error(response?.message || 'Erreur lors de la récupération du profil.');
    }
    updateHtmlContent('#content', response.html);
    return response.message;
  } catch (error) {
    throw error;
  }
}

export async function handleFriendProfile(friendName) {
  try {
    const responseMessage = await loadFriendProfile(friendName);
    if (responseMessage) {
      showStatusMessage(responseMessage, 'success');
    }
  } catch (error) {
    showStatusMessage(error?.message || 'Erreur lors de la récupération du profil.', 'error');
  }
}
