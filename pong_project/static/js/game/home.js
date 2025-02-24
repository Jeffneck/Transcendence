"use strict";
import { updateHtmlContent, showStatusMessage } from '../tools/index.js';
import { requestGet } from '../api/index.js';
import { navigateTo } from '../router.js';

/**
 * Initialise la vue d'accueil du jeu.
 * Récupère le contenu HTML et attache les événements nécessaires.
 */
export async function initializeGameHomeView() {
  try {
    const data = await requestGet('game', 'home');
    if (data && data.html) {
      updateHtmlContent('#content', data.html);
    } else {
      showStatusMessage('Données HTML manquantes pour GameHomeView.', 'error');
    }
  } catch (error) {
    showStatusMessage('Erreur lors du chargement de la page d\'accueil du jeu.', 'error');
  }
  
  const playBtn = document.querySelector('#play-btn-home');
  if (!playBtn) {
    showStatusMessage('Bouton "Jouer" introuvable.', 'error');
    return;
  }
  
  if (!playBtn.dataset.bound) {
    playBtn.addEventListener('click', (e) => {
      e.preventDefault();
      navigateTo('/game-options');
    });
    playBtn.dataset.bound = 'true';
  }
}
