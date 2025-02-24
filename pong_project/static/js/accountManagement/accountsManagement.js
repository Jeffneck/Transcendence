"use strict";
import { requestGet, requestPost } from "../api/index.js";
import { updateHtmlContent, showStatusMessage } from "../tools/index.js";
import { initializeaccountsManagementFormHandlers } from "./index.js";

async function loadAccountsManagement() {
  try {
    const response = await requestGet('accounts', 'gestion_profil');
    if (response?.status === 'success' && response.html) {
      updateHtmlContent('#content', response.html);
      return true;
    } else {
      throw new Error(response?.message || 'Erreur lors du chargement de la vue de gestion de profil.');
    }
  } catch (error) {
    showStatusMessage(error.message || 'Erreur lors du chargement de la vue de gestion de profil.', 'error');
    return false;
  }
}

export async function handleAccountsManagement() {
  const accountsManagementLoaded = await loadAccountsManagement();
  if (accountsManagementLoaded) {
    // Attache les événements spécifiques à la gestion de profil
    initializeaccountsManagementFormHandlers();
  }
}
