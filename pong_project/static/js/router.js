"use strict";
import { initializeHomeView } from './landing/coreHome.js';
import { handleLogin, initializeRegisterView, initializeLogin2FAView, handleDisable2FA, handleEnable2FA, handleDeleteAccount } from './auth/index.js';
import {  initializeGameHomeView, handleGameMenu, createGameOnline, handleTournament } from './game/index.js';
import { handleAccountsManagement } from './accountManagement/index.js';
import { handleViewProfile } from './userProfile/index.js';
import { handleFriendProfile } from './friends/index.js';
import { handleNavbar } from './navbar/loadNavbar.js';
import { initializeNotFoundView } from './tools/errorPage.js';


const router = new window.Navigo('/', { hash: false });

export function initializeRouter() {
  router
    .on('/', () => {
      handleNavbar();
      initializeHomeView();
    })
    .on('/login', () => { handleLogin(); })
    .on('/login-2fa', () => { initializeLogin2FAView(); })
    .on('/register', () => { initializeRegisterView(); })
    .on('/enable-2fa', () => { handleEnable2FA(); })
    .on('/disable-2fa', () => { handleDisable2FA(); })
    .on('/delete-account', () => { handleDeleteAccount(); })
    .on('/home', () => { initializeGameHomeView(); })
    .on('/account', () => { handleAccountsManagement(); })
    .on('/profile', () => { handleViewProfile(); })
    .on('/game-options', () => { handleGameMenu(); })
    .on('/online', () => { createGameOnline(); })
    .on('/tournament', () => { handleTournament(); })
    .on('/game-loading', () => { startLoading(); })
    .on('/profile/:friendUsername', ({ data }) => {
      const friendUsername = data.friendUsername;
      handleFriendProfile(friendUsername);
    })
    .notFound(() => { initializeNotFoundView(); });

  window.addEventListener("popstate", () => {
    stopCurrentActions()
    router.resolve();
  });

  router.resolve();
}

export function navigateTo(route) {
    stopCurrentActions()
    router.navigate(route);
}


function stopCurrentActions(){

    if (window.currentGameSocket && window.currentGameSocket.readyState === WebSocket.OPEN) {
        window.currentGameSocket.close();
    }
    window.currentGameSocket = null;
    window.stopTournamentFlow = true;
}