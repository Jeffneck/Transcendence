"use strict";
export function showStatusMessage(message, status) {
  const popup = document.getElementById('popup');
  const info = document.getElementById('info');
  if (info) {
    info.textContent = message;
  }
  popup.classList.remove('success', 'error', 'd-none', 'hide');
  if (status === 'success') {
    popup.classList.add('success');
  } else if (status === 'error') {
    popup.classList.add('error');
  }
  popup.classList.add('show');
  setTimeout(() => {
    popup.classList.remove('show');
    popup.classList.add('hide');
    setTimeout(() => popup.classList.add('d-none'), 500);
  }, 3000);
}
