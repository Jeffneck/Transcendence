"use strict";
import { requestGet } from '../api/index.js';
import { isTouchDevice, showStatusMessage, updateHtmlContent } from '../tools/index.js';
import { handleLocalGame } from './localGame.js';
import { createGameOnline } from './onlineGame.js';
import { navigateTo } from '../router.js';

/**
 * Attache les événements du menu de jeu pour les sections "local", "online" et "tournament".
 */
function attachGameMenuEvents() {
  const sections = ['local', 'online', 'tournament'];
  const isTouch = isTouchDevice();

  sections.forEach((section) => {
    // Bouton de sélection : affiche le panneau de personnalisation correspondant
    const selectBtn = document.getElementById(`${section}-game-btn`);
    if (selectBtn) {
      selectBtn.addEventListener('click', () => {
        sections.forEach((s) => {
          document.getElementById(`customization-${s}`)?.classList.add('d-none');
        });
        document.getElementById(`customization-${section}`)?.classList.remove('d-none');
      });
    }

    // Bouton "Voir Tuto" : bascule l'affichage du tutoriel
    const tutorialBtn = document.getElementById(`tutorial-btn-${section}`);
    if (tutorialBtn) {
      tutorialBtn.addEventListener('click', () => {
        const tutorialContent = document.getElementById(`tutorial-content-${section}`);
        tutorialContent?.classList.toggle('collapse');
      });
    }

    // Gestion de la vitesse de la balle (aucune action requise pour l'instant)
    const ballSpeedElem = document.getElementById(
      `ballSpeed${section.charAt(0).toUpperCase() + section.slice(1)}`
    );
    if (ballSpeedElem) {
      ballSpeedElem.addEventListener('input', (event) => {
        // Optionnel : mettre à jour la valeur en temps réel si besoin
      });
    }

    // Bouton principal : démarrer la partie ou lancer l'invitation
    const startGameButton = document.getElementById(`start-game-btn-${section}`);
    if (!startGameButton) return;

    // Section "local"
    if (section === 'local') {
      if (isTouch) {
        showStatusMessage('Vous ne pouvez pas jouer en mode local sur un appareil tactile.', 'error');
        return;
      }
      startGameButton.addEventListener('click', async () => {
        const parametersForm = new FormData();
        parametersForm.append('game_type', section);

        // Récupération des éléments de personnalisation
        const ballSpeedElement = document.getElementById(`ballSpeed${section}`);
        const paddleSizeElement = document.getElementById(`paddleSizeSelect${section}`);
        const bonusCheckbox = document.getElementById(`bonus${section}`);
        const obstacleCheckbox = document.getElementById(`bonusObstacle${section}`);

        if (!ballSpeedElement || !paddleSizeElement) {
          showStatusMessage(`Impossible de trouver les champs pour la section "${section}".`, 'error');
          return;
        }

        // Lecture des valeurs et ajout au formulaire
        parametersForm.append('ball_speed', ballSpeedElement.value);
        parametersForm.append('paddle_size', paddleSizeElement.value);
        parametersForm.append('bonus_enabled', bonusCheckbox?.checked ?? false);
        parametersForm.append('obstacles_enabled', obstacleCheckbox?.checked ?? false);
        parametersForm.append('is_touch', isTouch);
        await handleLocalGame(parametersForm);
      });
    }

    // Section "online"
    if (section === 'online') {
      startGameButton.addEventListener('click', async () => {
        try {
          const ballSpeedElement = document.getElementById(`ballSpeed${section}`);
          const paddleSizeElement = document.getElementById(`paddleSizeSelect${section}`);
          const bonusCheckbox = document.getElementById(`bonus${section}`);
          const obstacleCheckbox = document.getElementById(`bonusObstacle${section}`);

          if (!ballSpeedElement || !paddleSizeElement) {
            showStatusMessage(`Impossible de trouver les champs pour la section "${section}".`, 'error');
            return;
          }

          // Stocker les paramètres de jeu en mémoire
          const onlineParams = {
            ball_speed: ballSpeedElement.value,
            paddle_size: paddleSizeElement.value,
            bonus_enabled: bonusCheckbox?.checked ?? false,
            obstacles_enabled: obstacleCheckbox?.checked ?? false,
          };
          sessionStorage.setItem('params', JSON.stringify(onlineParams));
          navigateTo('/online');
        } catch (err) {
          showStatusMessage('Erreur lors de la phase d\'invitation.', 'error');
        }
      });
    }

    // Section "tournament"
    if (section === 'tournament') {
      startGameButton.addEventListener('click', async () => {
        if (isTouch) {
          showStatusMessage('Vous ne pouvez pas jouer en tournoi sur un appareil tactile.', 'error');
          return;
        }

        const ballSpeedElement = document.getElementById(`ballSpeed${section}`);
        const paddleSizeElement = document.getElementById(`paddleSizeSelect${section}`);
        const bonusCheckbox = document.getElementById(`bonus${section}`);
        const obstacleCheckbox = document.getElementById(`bonusObstacle${section}`);

        if (!ballSpeedElement || !paddleSizeElement) {
          showStatusMessage(`Impossible de trouver les champs pour la section "${section}".`, 'error');
          return;
        }

        // Stocker les paramètres du tournoi en mémoire
        const tournamentParams = {
          ball_speed: ballSpeedElement.value,
          paddle_size: paddleSizeElement.value,
          bonus_enabled: bonusCheckbox?.checked ?? false,
          obstacles_enabled: obstacleCheckbox?.checked ?? false,
        };
        sessionStorage.setItem('params', JSON.stringify(tournamentParams));
        navigateTo('/tournament');
      });
    }
  });
}

/**
 * Charge le menu du jeu et attache les événements correspondants.
 */
export async function handleGameMenu() {
  try {
    // Récupération du HTML du menu de jeu
    const response = await requestGet('game', 'menu');
    if (!response) {
      showStatusMessage('Erreur lors du chargement du menu du jeu.', 'error');
      return;
    }
    // Injection du HTML dans le conteneur #content
    updateHtmlContent('#content', response.html);
    // Attachement des événements
    attachGameMenuEvents();
  } catch (error) {
    showStatusMessage('Erreur dans le chargement du menu du jeu.', 'error');
  }
}
