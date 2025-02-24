"use strict";
import { requestGet } from '../api/index.js';
import { isTouchDevice, showStatusMessage, updateHtmlContent } from '../tools/index.js';
import { handleLocalGame } from './localGame.js';
import { navigateTo } from '../router.js';


function attachGameMenuEvents() {
  const sections = ['local', 'online', 'tournament'];
  const isTouch = isTouchDevice();

  sections.forEach((section) => {
    
    const selectBtn = document.getElementById(`${section}-game-btn`);
    if (selectBtn) {
      selectBtn.addEventListener('click', () => {
        sections.forEach((s) => {
          document.getElementById(`customization-${s}`)?.classList.add('d-none');
        });
        document.getElementById(`customization-${section}`)?.classList.remove('d-none');
      });
    }

    
    const tutorialBtn = document.getElementById(`tutorial-btn-${section}`);
    if (tutorialBtn) {
      tutorialBtn.addEventListener('click', () => {
        const tutorialContent = document.getElementById(`tutorial-content-${section}`);
        tutorialContent?.classList.toggle('collapse');
      });
    }

    
    const ballSpeedElem = document.getElementById(
      `ballSpeed${section.charAt(0).toUpperCase() + section.slice(1)}`
    );
    if (ballSpeedElem) {
      ballSpeedElem.addEventListener('input', (event) => {
        
      });
    }

    
    const startGameButton = document.getElementById(`start-game-btn-${section}`);
    if (!startGameButton) return;

    
    if (section === 'local') {
      if (isTouch) {
        showStatusMessage('Vous ne pouvez pas jouer en mode local sur un appareil tactile.', 'error');
        return;
      }
      startGameButton.addEventListener('click', async () => {
        const parametersForm = new FormData();
        parametersForm.append('game_type', section);

        
        const ballSpeedElement = document.getElementById(`ballSpeed${section}`);
        const paddleSizeElement = document.getElementById(`paddleSizeSelect${section}`);
        const bonusCheckbox = document.getElementById(`bonus${section}`);
        const obstacleCheckbox = document.getElementById(`bonusObstacle${section}`);

        if (!ballSpeedElement || !paddleSizeElement) {
          showStatusMessage(`Impossible de trouver les champs pour la section "${section}".`, 'error');
          return;
        }

        
        parametersForm.append('ball_speed', ballSpeedElement.value);
        parametersForm.append('paddle_size', paddleSizeElement.value);
        parametersForm.append('bonus_enabled', bonusCheckbox?.checked ?? false);
        parametersForm.append('obstacles_enabled', obstacleCheckbox?.checked ?? false);
        parametersForm.append('is_touch', isTouch);
        await handleLocalGame(parametersForm);
      });
    }

    
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

export async function handleGameMenu() {
  try {
    
    const response = await requestGet('game', 'menu');
    if (!response) {
      showStatusMessage('Erreur lors du chargement du menu du jeu.', 'error');
      return;
    }
    
    updateHtmlContent('#content', response.html);
    
    attachGameMenuEvents();
  } catch (error) {
    showStatusMessage('Erreur dans le chargement du menu du jeu.', 'error');
  }
}
