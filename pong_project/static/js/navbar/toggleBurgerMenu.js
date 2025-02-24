"use strict";
import { refreshBurgerMenu } from './loadNavbar.js';

export async function toggleBurgerMenu(flag) {
  const menu = document.getElementById('burger-menu');
  const overlay = document.getElementById('overlay');
  if (flag === 'refresh btn') return;
  if (!menu || !overlay) return;
  if (menu.style.display === 'block') {
    closeBurgerMenu(menu, overlay);
  } else {
    openBurgerMenu(menu, overlay);
  }
}

async function openBurgerMenu(menu, overlay) {
  menu.style.display = 'block';
  overlay.style.display = 'block';
  await refreshBurgerMenu();
}

function closeBurgerMenu(menu, overlay) {
  menu.style.display = 'none';
  overlay.style.display = 'none';
}
