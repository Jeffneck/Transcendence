"use strict";
export function updateTextContent(selector, text) {
  const element = document.querySelector(selector);
  if (element) {
    element.textContent = text;
  }
}

export function updateAttribute(selector, attribute, value) {
  const element = document.querySelector(selector);
  if (element) {
    element.setAttribute(attribute, value);
  } 
}

export function updateHtmlContent(selector, html) {
  try {
    const element = document.querySelector(selector);
    if (element) {
      element.innerHTML = html || '<p>Erreur lors du chargement du contenu.</p>';
    }
  } catch (error) {}
}
