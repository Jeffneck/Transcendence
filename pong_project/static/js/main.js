"use strict";
import { handleNavbar } from './navbar/index.js';
import { loadPongAnimation } from './modules/groundAnimation.js';
import { adjustBurgerHeight, adjustSinNavHeight, adjustAllContainers, adjustContainerIfExists } from './modules/animations.js';
import { initializeRouter } from './router.js';

window.addEventListener('popstate', function(event) {
  console.log("Retour en arrière détecté !");
  // Ajoute ici le code pour gérer l'événement
});


document.addEventListener('DOMContentLoaded', async () => {
  console.debug('DOMContentLoaded');
  await handleNavbar();
  initializeRouter();
  loadPongAnimation();
  adjustAllContainers();
  adjustBurgerHeight();
  adjustSinNavHeight();
  adjustContainerIfExists('login');
  adjustContainerIfExists('register');
  adjustContainerIfExists('bracket_tournament');
  adjustContainerIfExists('results-container');
  adjustContainerIfExists('select_tournament');
  adjustContainerIfExists('invite-container');
});
