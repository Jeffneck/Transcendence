"use strict";

import { requestPost } from "../api/index.js";
import { launchLiveGameWithOptions } from "./live_game.js";


export async function launchLiveGameWithOptions(gameId, userRole, urlStartButton) {
  try {
    const protocol = (window.location.protocol === 'https:') ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/pong/${gameId}/`;
    const startGameSelector = document.querySelector("#startGameBtn") || null;
    let onStartGame = null;
    if (urlStartButton && startGameSelector) {
      onStartGame = async () => {
        startGameSelector.classList.add('d-none');
        const formData = new FormData();
        formData.append('game_id', gameId);
        formData.append('userRole', userRole);
        const response = await requestPost('game', urlStartButton, formData);
      };
    }
    return initLiveGame({ gameId, userRole, wsUrl, startGameSelector, onStartGame });
  } catch (error) {
    throw error;
  }
}


