/* live_game.js
 *
 * Centralise les fonctions communes pour :
 * dessiner le canvas, les bumpers et les powerups
 * lancer le jeu en co-routine avec le bouton startGame 
 * recevoir les notifications (envoyées par broadcast.py > consumers.py > websocket)
 *    detecter la position de tous les elements de jeu (gameState)
 *    afficher des animations aux lieux d'impacts de la balle /lieux d'apparition des bumpers et powerups 
 * 
 */

import { requestPost } from '../api/index.js';
import { createPowerupSVG, createBumperSVG } from './live_game_svg.js';
import { isTouchDevice } from "../tools/index.js";
import { navigateTo } from '../router.js';

let animationId;


// Fonction exportée pour lancer la partie avec options
export async function launchLiveGameWithOptions(gameId, userRole, urlStartButton) {
  const protocol = (window.location.protocol === 'https:') ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}/ws/pong/${gameId}/`;

  let startGameSelector = null;
  let onStartGame = null;
  
  if (urlStartButton) {
    startGameSelector = document.querySelector("#startGameBtn");
    if (!startGameSelector) {
      console.error("L'élément avec le sélecteur '#startGameBtn' n'a pas été trouvé.");
    }
    
    onStartGame = async (gameId) => {
      if (startGameSelector) {
        startGameSelector.classList.add('d-none');
      }
      const url = urlStartButton;
      const formData = new FormData();
      formData.append('game_id', gameId);
      formData.append('userRole', userRole);
      const response = await requestPost('game', url, formData);
      if (response.status !== 'success') {
        return;
      }
    };
  }

  return initLiveGame({
    gameId,
    userRole,
    wsUrl,
    startGameSelector,
    onStartGame
  });
}

// ========== Fonctions Utilitaires Globales ==========

// Initialise les images des powerups
function initPowerupImages(powerupImages) {
  Object.keys(powerupImages).forEach(type => {
    powerupImages[type].src = createPowerupSVG(type);
  });
}

// Applique un effet flash sur le gameState
function applyFlashEffect(gameState, duration = 300) {
  gameState.flash_effect = true;
  setTimeout(() => {
    gameState.flash_effect = false;
  }, duration);
}

// Crée un effet visuel de spawn/expiration et le supprime après la durée définie
function createSpawnEffect(type, x, y, effectType, color, collisionEffects, SPAWN_EFFECT_DURATION, EXPIRE_EFFECT_DURATION) {
  const effect = {
    type,
    x,
    y,
    effectType,
    color: color || '#FFFFFF',
    startTime: Date.now(),
    alpha: 1
  };
  collisionEffects.push(effect);
  setTimeout(() => {
    const index = collisionEffects.indexOf(effect);
    if (index > -1) {
      collisionEffects.splice(index, 1);
    }
  }, type.includes('spawn') ? SPAWN_EFFECT_DURATION : EXPIRE_EFFECT_DURATION);
}

// Crée un effet de collision et le supprime après EFFECT_DURATION
function createCollisionEffect(type, x, y, color, collisionEffects, EFFECT_DURATION) {
  const effect = {
    type,
    x,
    y,
    color,
    startTime: Date.now(),
    alpha: 1
  };
  collisionEffects.push(effect);
  setTimeout(() => {
    const index = collisionEffects.indexOf(effect);
    if (index > -1) {
      collisionEffects.splice(index, 1);
    }
  }, EFFECT_DURATION);
}

// Affiche les effets de collision en animation
function drawCollisionEffects(ctx, collisionEffects, SPAWN_EFFECT_DURATION, EXPIRE_EFFECT_DURATION) {
  collisionEffects.forEach(effect => {
    const now = Date.now();
    const age = now - effect.startTime;
    const duration = effect.type.includes('spawn') ? SPAWN_EFFECT_DURATION : EXPIRE_EFFECT_DURATION;
    const rawProgress = age / duration;
    const progress = Math.max(0, Math.min(rawProgress, 1));

    ctx.save();
    ctx.globalAlpha = Math.max(0, 1 - progress);

    switch(effect.type) {
      case 'paddle_collision': {
        const rippleSize = Math.max(0, 20 + (progress * 40));
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 3 * (1 - progress);
        ctx.beginPath();
        ctx.arc(effect.x, effect.y, rippleSize, 0, Math.PI * 2);
        ctx.stroke();
        break;
      }
      case 'bumper_collision': {
        const numParticles = 8;
        const radius = Math.max(0, 30 * progress);
        ctx.strokeStyle = '#4169E1';
        ctx.lineWidth = 3 * (1 - progress);
        for (let i = 0; i < numParticles; i++) {
          const angle = (i / numParticles) * Math.PI * 2;
          const startX = effect.x + Math.cos(angle) * 10;
          const startY = effect.y + Math.sin(angle) * 10;
          const endX = effect.x + Math.cos(angle) * radius;
          const endY = effect.y + Math.sin(angle) * radius;
          ctx.beginPath();
          ctx.moveTo(startX, startY);
          ctx.lineTo(endX, endY);
          ctx.stroke();
        }
        break;
      }
      case 'powerup_spawn': {
        ctx.strokeStyle = effect.color;
        ctx.lineWidth = 2;
        const circles = 3;
        for (let i = 0; i < circles; i++) {
          const circleProgress = (progress + (i / circles)) % 1;
          const radius = Math.max(0, circleProgress * 40);
          ctx.beginPath();
          ctx.arc(effect.x, effect.y, radius, 0, Math.PI * 2);
          ctx.stroke();
        }
        const sparkles = 8;
        for (let i = 0; i < sparkles; i++) {
          const angle = (i / sparkles) * Math.PI * 2;
          const sparkleDistance = Math.max(0, 20 + (progress * 20));
          const x = effect.x + Math.cos(angle) * sparkleDistance;
          const y = effect.y + Math.sin(angle) * sparkleDistance;
          ctx.beginPath();
          ctx.arc(x, y, 2, 0, Math.PI * 2);
          ctx.fillStyle = effect.color;
          ctx.fill();
        }
        break;
      }
      case 'powerup_expire': {
        const fadeRadius = Math.max(0, 20 * (1 - progress));
        ctx.strokeStyle = effect.color;
        ctx.lineWidth = 2 * (1 - progress);
        ctx.beginPath();
        ctx.arc(effect.x, effect.y, fadeRadius, 0, Math.PI * 2);
        ctx.stroke();
        const particles = 6;
        for (let i = 0; i < particles; i++) {
          const angle = (i / particles) * Math.PI * 2;
          const distance = fadeRadius * 2;
          const x = effect.x + Math.cos(angle) * distance * progress;
          const y = effect.y + Math.sin(angle) * distance * progress;
          ctx.beginPath();
          ctx.arc(x, y, 2, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      }
      case 'bumper_spawn': {
        ctx.strokeStyle = '#4169E1';
        ctx.lineWidth = 2;
        const size = Math.max(0, 40 * progress);
        const rotation = progress * Math.PI;
        ctx.translate(effect.x, effect.y);
        ctx.rotate(rotation);
        ctx.beginPath();
        ctx.moveTo(0, -size);
        ctx.lineTo(size, 0);
        ctx.lineTo(0, size);
        ctx.lineTo(-size, 0);
        ctx.closePath();
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, -size * 1.5);
        ctx.lineTo(size * 1.5, 0);
        ctx.lineTo(0, size * 1.5);
        ctx.lineTo(-size * 1.5, 0);
        ctx.closePath();
        ctx.stroke();
        break;
      }
      case 'bumper_expire': {
        ctx.strokeStyle = '#4169E1';
        ctx.lineWidth = 2 * (1 - progress);
        const rings = 3;
        for (let i = 0; i < rings; i++) {
          const ringProgress = (progress + (i / rings)) % 1;
          const ringRadius = Math.max(0, 20 * ringProgress);
          ctx.beginPath();
          ctx.arc(effect.x, effect.y, ringRadius, 0, Math.PI * 2);
          ctx.stroke();
          const particleCount = 8;
          for (let j = 0; j < particleCount; j++) {
            const particleAngle = (j / particleCount) * Math.PI * 2;
            const distance = ringRadius * (1 + progress);
            const px = effect.x + Math.cos(particleAngle) * distance;
            const py = effect.y + Math.sin(particleAngle) * distance;
            ctx.fillStyle = '#4169E1';
            ctx.fillRect(px - 1, py - 1, 2, 2);
          }
        }
        break;
      }
    }
    ctx.restore();
  });
}

// Affiche le compte à rebours sur le canvas
function drawCountdown(ctx, canvas, gameState) {
  if (typeof gameState.countdown !== 'undefined') {
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'white';
    ctx.font = 'bold 80px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(255, 255, 255, 0.8)';
    ctx.shadowBlur = 20;
    ctx.fillText(gameState.countdown, canvas.width / 2, canvas.height / 3);
    ctx.restore();
  }
}

// Affiche le message de score (en cas de "scored")
function drawScored(ctx, canvas, gameState) {
  if (typeof gameState.scoreMsg !== 'undefined') {
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'yellow';
    ctx.font = 'bold 80px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(255, 255, 0, 0.8)';
    ctx.shadowBlur = 20;
    ctx.fillText(gameState.scoreMsg, canvas.width / 2, canvas.height / 3);
    ctx.restore();
  }
}

// Met à jour l'affichage du score
function updateScoreDisplay(gameState, canvas) {
  const scoreEl = document.getElementById("score-nb");
  if (scoreEl) {
    scoreEl.innerText = ` ${gameState.score_left} - ${gameState.score_right} `;
  }
}

// Gère le redimensionnement du canvas et des éléments associés
function handleResize(canvas, ctx) {
  const ORIGINAL_WIDTH = 800;
  const ORIGINAL_HEIGHT = 400;
  const margin = 12;
  if (!canvas) return;
  if (!ctx) return;
  const container = document.querySelector('.game-container');
  if (!container) return;
  const containerWidth = container.clientWidth;
  const windowHeight = window.innerHeight;
  let scale = Math.min(containerWidth / ORIGINAL_WIDTH, windowHeight * 0.7 / ORIGINAL_HEIGHT);
  const touchControls = document.querySelector('.touch-controls');
  if (touchControls) {
    touchControls.style.height = (ORIGINAL_HEIGHT * scale) + 'px';
  }
  canvas.style.width = (ORIGINAL_WIDTH * scale) + 'px';
  canvas.style.height = (ORIGINAL_HEIGHT * scale) + 'px';
  canvas.width = ORIGINAL_WIDTH;
  canvas.height = ORIGINAL_HEIGHT;
  container.style.height = Math.min(windowHeight * 0.8, containerWidth / 2) + 'px';
  ctx.imageSmoothingEnabled = false;
  const s = scale;
  const scoreDisplay = document.getElementById("score-display");
  if (scoreDisplay) {
    container.style.position = "relative";
    const canvasLeft = canvas.offsetLeft;
    const canvasTop = canvas.offsetTop;
    const canvasDisplayWidth = ORIGINAL_WIDTH * s;
    scoreDisplay.style.position = "absolute";
    scoreDisplay.style.left = (canvasLeft + canvasDisplayWidth / 2) + "px";
    scoreDisplay.style.top = (canvasTop + 2) + "px";
    scoreDisplay.style.transform = "translate(-50%, 0)";
    scoreDisplay.style.transformOrigin = "center top";
    scoreDisplay.style.fontSize = (30 * s) + "px";
    scoreDisplay.style.width = (canvasDisplayWidth * 0.7) + "px";
    const totalWidth = canvasDisplayWidth * 0.7;
    const playerNameWidth = (totalWidth * 0.4) + "px";
    const scoreNbWidth = (totalWidth * 0.2) + "px";
    const playerNames = scoreDisplay.querySelectorAll('.player-name');
    if (playerNames && playerNames.length > 0) {
      playerNames.forEach(function(name) {
        if (name) {
          name.style.display = "inline-block";
          name.style.width = playerNameWidth;
          name.style.verticalAlign = "middle";
          if (name.classList.contains("left")) {
            name.style.textAlign = "right";
          } else if (name.classList.contains("right")) {
            name.style.textAlign = "left";
          }
        }
      });
    }
    const scoreNb = scoreDisplay.querySelector('#score-nb');
    if (scoreNb) {
      scoreNb.style.width = scoreNbWidth;
      scoreNb.style.verticalAlign = "middle";
      scoreNb.style.textAlign = "center";
    }
  }
  if (isTouchDevice() && window.innerWidth < window.innerHeight) {
    const livegame = document.getElementById("livegame");
    if (livegame) {
      livegame.classList.add("rotate90");
      livegame.style.display = "flex";
      livegame.style.height = window.innerHeight + "px";
      livegame.style.width = "100vh";
      const innerContainer = livegame.querySelector(".game-container");
      if (innerContainer) {
        innerContainer.style.display = "flex";
        innerContainer.style.flexDirection = "column";
        innerContainer.style.alignItems = "center";
        innerContainer.style.justifyContent = "center";
        innerContainer.style.maxHeight = "90%";
        innerContainer.style.width = "85%";
        innerContainer.style.margin = "auto";
        innerContainer.style.marginLeft = "0";
        innerContainer.style.left = "4%";
      }
      const containerWidth = innerContainer ? innerContainer.clientWidth : window.innerWidth;
      let scale = Math.min(containerWidth / ORIGINAL_WIDTH, window.innerWidth * 0.8 / ORIGINAL_HEIGHT);
      const minCanvasHeight = 100;
      if ((ORIGINAL_HEIGHT * scale) < minCanvasHeight) {
        scale = minCanvasHeight / ORIGINAL_HEIGHT;
      }
      const canvas = document.getElementById('gameCanvas');
      canvas.style.width = (ORIGINAL_WIDTH * scale) + 'px';
      canvas.style.height = (ORIGINAL_HEIGHT * scale) + 'px';
      canvas.width = ORIGINAL_WIDTH;
      canvas.height = ORIGINAL_HEIGHT;
      const scoreDisplay = document.getElementById("score-display");
      if (scoreDisplay) {
        innerContainer.style.position = "relative";
        const canvasLeft = canvas.offsetLeft;
        const canvasTop = canvas.offsetTop;
        const canvasDisplayWidth = ORIGINAL_WIDTH * scale;
        scoreDisplay.style.position = "absolute";
        scoreDisplay.style.left = (canvasLeft + canvasDisplayWidth / 2) + "px";
        scoreDisplay.style.top = (canvasTop + 2) + "px";
        scoreDisplay.style.transform = "translate(-50%, 0)";
        scoreDisplay.style.transformOrigin = "center top";
        scoreDisplay.style.fontSize = `clamp(16px, ${30 * scale}px, 30px)`;
        scoreDisplay.style.width = (canvasDisplayWidth * 0.8) + "px";
        const totalWidth = canvasDisplayWidth * 0.7;
        const playerNameWidth = (totalWidth * 0.4) + "px";
        const scoreNbWidth = (totalWidth * 0.2) + "px";
        const playerNames = scoreDisplay.querySelectorAll('.player-name');
        if (playerNames && playerNames.length > 0) {
          playerNames.forEach(function(name) {
            if (name) {
              name.style.display = "inline-block";
              name.style.width = playerNameWidth;
              name.style.verticalAlign = "middle";
              if (name.classList.contains("left")) {
                name.style.textAlign = "right";
              } else if (name.classList.contains("right")) {
                name.style.textAlign = "left";
              }
            }
          });
        }
        const scoreNb = scoreDisplay.querySelector('#score-nb');
        if (scoreNb) {
          scoreNb.style.width = scoreNbWidth;
          scoreNb.style.verticalAlign = "middle";
          scoreNb.style.textAlign = "center";
        }
      }
      const livegame = document.getElementById("livegame");
      if (livegame) {
        const touchControls = livegame.querySelector(".touch-controls");
        if (touchControls) {
          touchControls.style.position = "static";
          touchControls.style.marginTop = "auto";
          const canvasRect = canvas.getBoundingClientRect();
          touchControls.style.width = (canvasRect.width * 0.1) + "px";
          touchControls.style.marginLeft = (canvasRect.width * 2.15) + "px";
        }
      }
    }
  } else if ((touchControls && getComputedStyle(touchControls).display !== "none") || (isTouchDevice() && window.innerWidth > window.innerHeight)) {
    const livegame = document.getElementById("livegame");
    if (livegame) {
      livegame.classList.remove("rotate90");
      livegame.style.height = "100%";
      livegame.style.width = "100%";
    }
    if (touchControls) {
      const canvasRect = canvas.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      const gap = canvasRect.width * 0.01;
      const relativeCanvasRight = canvasRect.right - containerRect.left;
      touchControls.style.position = 'absolute';
      touchControls.style.left = (relativeCanvasRight + gap) + 'px';
      const relativeCanvasTop = canvasRect.top - containerRect.top;
      touchControls.style.top = relativeCanvasTop + 'px';
      touchControls.style.height = canvasRect.height + 'px';
      touchControls.style.width = (canvasRect.width * 0.07) + 'px';
      touchControls.style.marginLeft = "0px";
    }
  }
}

// Active et gère les contrôles tactiles pour le jeu
function initializeTouchControls(userRole, socket) {
  if (!isTouchDevice()) return;
  let lastTouchEnd = 0;
  document.addEventListener('touchend', function(e) {
    const now = Date.now();
    if (now - lastTouchEnd <= 300) {
      e.preventDefault();
    }
    lastTouchEnd = now;
  }, { passive: false });
  const btnUp = document.getElementById("touch1");
  const btnDown = document.getElementById("touch2");
  if (!btnUp || !btnDown) {
    console.error("Les boutons tactiles ne sont pas définis dans le DOM.");
    return;
  }
  btnUp.addEventListener('touchstart', (e) => {
    e.preventDefault();
    socket.send(JSON.stringify({
      action: "start_move",
      player: userRole,
      direction: "up"
    }));
  });
  btnUp.addEventListener('touchend', (e) => {
    e.preventDefault();
    socket.send(JSON.stringify({
      action: "stop_move",
      player: userRole
    }));
  });
  btnUp.addEventListener('click', (e) => {
    e.preventDefault();
    socket.send(JSON.stringify({
      action: "start_move",
      player: userRole,
      direction: "up"
    }));
    setTimeout(() => {
      socket.send(JSON.stringify({
        action: "stop_move",
        player: userRole
      }));
    }, 200);
  });
  btnDown.addEventListener('touchstart', (e) => {
    e.preventDefault();
    socket.send(JSON.stringify({
      action: "start_move",
      player: userRole,
      direction: "down"
    }));
  });
  btnDown.addEventListener('touchend', (e) => {
    e.preventDefault();
    socket.send(JSON.stringify({
      action: "stop_move",
      player: userRole
    }));
  });
  btnDown.addEventListener('click', (e) => {
    e.preventDefault();
    socket.send(JSON.stringify({
      action: "start_move",
      player: userRole,
      direction: "down"
    }));
    setTimeout(() => {
      socket.send(JSON.stringify({
        action: "stop_move",
        player: userRole
      }));
    }, 200);
  });
}

// Gère les événements clavier pour les appareils non tactiles
function setupKeyboardControls(userRole, socket) {
  const keysPressed = {};
  document.addEventListener('keydown', (evt) => {
    if (evt.key === "ArrowUp" || evt.key === "ArrowDown") {
      evt.preventDefault();
    }
    if (evt.repeat) return;
    let action = "start_move";
    let player = null, direction = null;
    if (userRole === 'both') {
      switch(evt.key) {
        case 'w':
        case 'W':
          player = 'left';
          direction = 'up';
          break;
        case 's':
        case 'S':
          player = 'left';
          direction = 'down';
          break;
        case 'ArrowUp':
          player = 'right';
          direction = 'up';
          break;
        case 'ArrowDown':
          player = 'right';
          direction = 'down';
          break;
      }
    } else if (userRole === 'right') {
      switch(evt.key) {
        case 'ArrowUp':
          player = 'right';
          direction = 'up';
          break;
        case 'ArrowDown':
          player = 'right';
          direction = 'down';
          break;
      }
    } else if (userRole === 'left') {
      switch(evt.key) {
        case 'ArrowUp':
          player = 'left';
          direction = 'up';
          break;
        case 'ArrowDown':
          player = 'left';
          direction = 'down';
          break;
      }
    }
    if (player && direction && !keysPressed[evt.key]) {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ action, player, direction }));
      }
      keysPressed[evt.key] = true;
    }
  });
  document.addEventListener('keyup', (evt) => {
    let action = "stop_move";
    let player = null;
    if (userRole === 'both') {
      if (['w','W','s','S'].includes(evt.key)) {
        player = 'left';
      }
    }
    if ((userRole === 'both' || userRole === 'right' || userRole === 'left') && !player) {
      if (['ArrowUp','ArrowDown'].includes(evt.key)) {
        if(userRole === 'both' || userRole === 'right')
          player = 'right';
        else if(userRole === 'left')
          player = 'left';
      }
    }
    if (player && keysPressed[evt.key]) {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ action, player }));
      }
      keysPressed[evt.key] = false;
    }
  });
}

// Gère les événements de glissement (swipe) sur les appareils tactiles
function setupTouchSwipe() {
  const SWIPE_THRESHOLD = 50;
  let touchStartY = null;
  document.addEventListener('touchstart', (e) => {
    if (e.touches.length === 1) {
      touchStartY = e.touches[0].clientY;
    }
  }, { passive: true });
  document.addEventListener('touchend', (e) => {
    if (touchStartY === null) return;
    const touchEndY = e.changedTouches[0].clientY;
    const deltaY = touchEndY - touchStartY;
    const navbar = document.getElementById('navbar');
    if (!navbar) return;
    if (deltaY > SWIPE_THRESHOLD) {
      navbar.classList.remove('hidden');
      setTimeout(() => {
        if (window.innerWidth > window.innerHeight) {
          navbar.classList.add('hidden');
        }
      }, 3000);
    }
    if (deltaY < -SWIPE_THRESHOLD) {
      navbar.classList.add('hidden');
    }
    touchStartY = null;
  });
}

// ========== Fonction Principale d'Initialisation du Live Game ==========

function initLiveGame(config) {
  return new Promise((resolve) => {
    // Masquer les boutons tactiles si l'appareil n'est pas tactile.
    if (!isTouchDevice()) {
      const touchControls = document.querySelector('.touch-controls');
      if (touchControls) {
        touchControls.style.display = 'none';
      }
    }

    // 1) Préparer les éléments HTML
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');
    const startGameBtn = config.startGameSelector;
    
    // 2) Gérer le bouton "Start" (optionnel)
    if (startGameBtn && config.onStartGame) {
      startGameBtn.classList.add("active");
      startGameBtn.addEventListener('click', async () => {
        await config.onStartGame();
      });
    }

    // Variables de configuration du jeu
    const collisionEffects = [];
    const EFFECT_DURATION = 300;
    const SPAWN_EFFECT_DURATION = 500;
    const EXPIRE_EFFECT_DURATION = 300;

    const activeEffects = { left: new Set(), right: new Set() };
    const effectTimers = {};
    let gameState = {
      type: 'game_state',
      ball_x: 400, 
      ball_y: 200,
      ball_size: 7,
      ball_speed_x: 4,
      ball_speed_y: 4,
      paddle_left_y: 170,
      paddle_right_y: 170,
      paddle_width: 10,
      paddle_left_height: 60,
      paddle_right_height: 60,
      score_left: 0, 
      score_right: 0,
      powerups: [],
      bumpers: [],
      flash_effect: false
    };

    // 3) Redimensionnement du canvas
    window.addEventListener('resize', () => handleResize(canvas, ctx));
    window.addEventListener('load', () => handleResize(canvas, ctx));
    window.addEventListener('orientationchange', function() {
      setTimeout(() => handleResize(canvas, ctx), 100);
    });
    handleResize(canvas, ctx);

    // 4) Gestion du swipe sur les appareils tactiles
    if (isTouchDevice()) {
      setupTouchSwipe();
    }

    // 5) Initialisation du WebSocket
    const socket = new WebSocket(config.wsUrl);
    window.currentGameSocket = socket;
    let socketClosed = false;

    socket.onopen = () => {
      initializeTouchControls(config.userRole, socket);
    };
    socket.onclose = () => {
      console.log("[live_game_utils] WebSocket connection closed.");
      socketClosed = true;
      cancelAnimationFrame(animationId); // Arrête la boucle
      resolve();
      return;
    };

    // 6) Gestion des messages reçus du WebSocket
    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
  
      if (data.type === 'game_state') {
        const prevLeft = new Set(activeEffects.left);
        const prevRight = new Set(activeEffects.right);
        gameState = data;
        activeEffects.left = prevLeft;
        activeEffects.right = prevRight;
      } else if (data.type === 'powerup_spawned') {
        const powerupColor = {
          'invert': '#FF69B4',
          'shrink': '#FF0000',
          'ice': '#00FFFF',
          'speed': '#FFD700',
          'flash': '#FFFF00',
          'sticky': '#32CD32'
        }[data.powerup.type] || '#FFFFFF';
        createSpawnEffect('powerup_spawn', data.powerup.x, data.powerup.y, data.powerup.type, powerupColor, collisionEffects, SPAWN_EFFECT_DURATION, EXPIRE_EFFECT_DURATION);
      } else if (data.type === 'powerup_expired') {
        createSpawnEffect('powerup_expire', data.powerup.x, data.powerup.y, data.powerup.type, undefined, collisionEffects, SPAWN_EFFECT_DURATION, EXPIRE_EFFECT_DURATION);
      } else if (data.type === 'bumper_spawned') {
        createSpawnEffect('bumper_spawn', data.bumper.x, data.bumper.y, undefined, undefined, collisionEffects, SPAWN_EFFECT_DURATION, EXPIRE_EFFECT_DURATION);
      } else if (data.type === 'bumper_expired') {
        createSpawnEffect('bumper_expire', data.bumper.x, data.bumper.y, undefined, undefined, collisionEffects, SPAWN_EFFECT_DURATION, EXPIRE_EFFECT_DURATION);
      } else if (data.type === 'countdown') {
        gameState.countdown = data.countdown_nb;
      } else if (data.type === 'scored') {
        gameState.scoreMsg = data.scoreMsg;
      } else if (data.type === 'collision_event') {
        const collision = data.collision;
        switch(collision.type) {
          case 'paddle_collision': {
            createCollisionEffect('paddle_collision', collision.paddle_side === 'left' ? 60 : canvas.width - 60, gameState.ball_y, undefined, collisionEffects, EFFECT_DURATION);
            break;
          }
          case 'border_collision': {
            createCollisionEffect('border_collision', collision.coor_x_collision, collision.border_side === 'up' ? 50 : 350, undefined, collisionEffects, EFFECT_DURATION);
            break;
          }
          case 'bumper_collision': {
            createCollisionEffect('bumper_collision', collision.bumper_x, collision.bumper_y, undefined, collisionEffects, EFFECT_DURATION);
            break;
          }
        }
      } else if (data.type === 'game_over' || data.type === 'game_aborted' ) {
        console.log('game over or aborted detected');
        socket.close();
        resolve();
      } 
      else if (data.type === 'powerup_applied') {
        if (data.effect === 'flash') {
          applyFlashEffect(gameState);
          return;
        }
        let displaySide = data.player;
        if (!['speed','sticky'].includes(data.effect)) {
          displaySide = (data.player === 'left') ? 'right' : 'left';
        }
        activeEffects[displaySide].add(data.effect);
        if (effectTimers[`${displaySide}_${data.effect}`]) {
          clearTimeout(effectTimers[`${displaySide}_${data.effect}`]);
        }
        effectTimers[`${displaySide}_${data.effect}`] = setTimeout(() => {
          activeEffects[displaySide].delete(data.effect);
        }, data.duration * 1000);
      }
    };

    // 7) Gestion du clavier pour les appareils non tactiles
    if (!isTouchDevice()) {
      setupKeyboardControls(config.userRole, socket);
    }

    // 8) Préparer les images pour les powerups et le bumper
    const powerupImages = {
      'invert': new Image(),
      'shrink': new Image(),
      'ice': new Image(),
      'speed': new Image(),
      'flash': new Image(),
      'sticky': new Image()
    };
    initPowerupImages(powerupImages);
    const bumperImage = new Image();
    bumperImage.src = createBumperSVG();

    // 9) Boucle de dessin (animation)
    function draw() {
      if (socketClosed === true) return;
      if (gameState.flash_effect) {
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      } else {
        ctx.fillStyle = '#101A32';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
  
        // Zone de jeu
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 2;
        ctx.strokeRect(50, 50, canvas.width - 100, canvas.height - 100);
  
        // Dessin des raquettes
        ['left', 'right'].forEach(side => {
          ctx.save();
          if (activeEffects[side].size > 0) {
            activeEffects[side].forEach(effect => {
              const glowColor = {
                'speed': '#FFD700',
                'shrink': '#FF0000',
                'ice': '#00FFFF',
                'sticky': '#32CD32',
                'invert': '#FF69B4',
                'flash': '#FFFF00'
              }[effect];
              ctx.shadowColor = glowColor;
              ctx.shadowBlur = 10; // La variable "scale" n'étant pas disponible ici, on laisse la valeur fixe
            });
          }
          ctx.fillStyle = 'white';
          if (side === 'left') {
            ctx.fillRect(50, gameState.paddle_left_y, gameState.paddle_width, gameState.paddle_left_height);
          } else {
            ctx.fillRect(canvas.width - 50 - gameState.paddle_width, gameState.paddle_right_y, gameState.paddle_width, gameState.paddle_right_height);
          }
          ctx.restore();
        });
  
        // Dessin de la balle
        ctx.fillStyle = 'white';
        ctx.beginPath();
        ctx.arc(gameState.ball_x, gameState.ball_y, gameState.ball_size, 0, 2 * Math.PI);
        ctx.fill();
  
        // Dessin des powerups
        gameState.powerups.forEach(orb => {
          const type = orb.type || 'speed';
          const img = powerupImages[type];
          if (img.complete) {
            ctx.save();
            const glowColors = {
              'invert': '#FF69B4',
              'shrink': '#FF0000',
              'ice': '#00FFFF',
              'speed': '#FFD700',
              'flash': '#FFFF00',
              'sticky': '#32CD32'
            };
            ctx.shadowColor = glowColors[type] || '#FFD700';
            ctx.shadowBlur = 10;
            ctx.drawImage(img, orb.x - 15, orb.y - 15, 30, 30);
            ctx.restore();
          }
        });
  
        // Dessin des bumpers
        gameState.bumpers.forEach(bmp => {
          if (bumperImage.complete) {
            ctx.save();
            ctx.shadowColor = '#4169E1';
            ctx.shadowBlur = 10;
            ctx.drawImage(bumperImage, bmp.x - bmp.size, bmp.y - bmp.size, bmp.size * 2, bmp.size * 2);
            ctx.restore();
          }
        });
      }
  
      updateScoreDisplay(gameState, canvas);
      drawCollisionEffects(ctx, collisionEffects, SPAWN_EFFECT_DURATION, EXPIRE_EFFECT_DURATION);
      drawCountdown(ctx, canvas, gameState);
      drawScored(ctx, canvas, gameState);
  
      console.log(`frame => ${socketClosed}`);
      animationId = requestAnimationFrame(draw);

    }
    draw();
  
    // Retourne un objet permettant d'accéder au socket et à l'état du jeu
    return {
      socket,
      getGameState: () => gameState
    };
  });
}
