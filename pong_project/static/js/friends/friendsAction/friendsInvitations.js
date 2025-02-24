"use strict";
import { requestPost } from '../../api/index.js';
import { refreshBurgerMenu } from '../../navbar/loadNavbar.js';
import { showStatusMessage } from '../../tools/index.js';


async function processFriendInvitation(requestId, action) {
  const formData = new FormData();
  formData.append('request_id', requestId);
  formData.append('action', action);
  const response = await requestPost('accounts', 'friends/handle-request', formData);
  if (!response || response.status !== 'success') {
    const errorMessage = response?.message || 'Erreur lors du traitement de la demande d\'ami.';
    throw new Error(errorMessage);
  }
  return response;
}

export async function handleFriendInvitation(requestId, action) {
  try {
    const response = await processFriendInvitation(requestId, action);
    showStatusMessage(response.message || 'Demande d\'ami traitée avec succès.', 'success');
    refreshBurgerMenu();
  } catch (error) {
    showStatusMessage(error?.message || 'Erreur lors du traitement de la demande d\'ami.', 'error');
  }
}
