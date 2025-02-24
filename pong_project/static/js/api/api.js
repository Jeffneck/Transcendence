"use strict";

import { navigateTo } from '../router.js';
import { HTTPError, ContentTypeError, NetworkError } from './apiErrors.js';
import { showStatusMessage } from '../tools/displayInfo.js';
import { clearSessionAndUI } from '../tools/clearSession.js';

// Déconnexion forcée de l'utilisateur en cas d'erreur critique
function forceLogout(message) {
  showStatusMessage(message, "error");
  setTimeout(() => { clearSessionAndUI(); }, 1000);
}

const Api = {
  async request(url, method = "GET", formData = null, customHeaders = {}) {
    try {
      const headers = { ...this.prepareHeaders(), ...customHeaders };

      // Rafraîchissement du token si nécessaire
      const jwtAccessToken = this.getJWTaccessToken();
      if (jwtAccessToken && this.isTokenExpiringSoon(jwtAccessToken)) {
        const newToken = await this.handleTokenRefresh();
        if (newToken) {
          headers["Authorization"] = `Bearer ${newToken}`;
        } else {
          forceLogout("Votre session a expiré, veuillez vous reconnecter.");
          return;
        }
      }

      let response = await this.sendRequest(url, method, formData, headers);

      // Gestion des erreurs d'authentification
      if (response.status === 401) {
        const data = await response.json();
        if (data.error_code === "not_authenticated") {
          showStatusMessage(data.message, "error");
          return;
        } else if (data.error_code === "forbidden") {
          showStatusMessage(data.message, "error");
          navigateTo(data.redirect);
          return;
        } else if (data.error_code === "token-error") {
          response = await this.handleUnauthorized(url, method, formData, customHeaders);
        } else {
          showStatusMessage(data.message, "error");
          return;
        }
      } else if (response.status === 403) {
        const data = await response.json();
        if (data.error_code === "auth_partial_required") {
          showStatusMessage(data.message, "error");
          forceLogout(data.message || "Session incomplète, reconnectez-vous.");
          return;
        } else {
          throw new HTTPError(data.message || "Erreur inconnue.", response.status);
        }
      }
      return await this.handleResponse(response);
    } catch (error) {
      if (error instanceof TypeError) {
        throw new NetworkError("Échec réseau : " + error.message);
      }
      if (error instanceof HTTPError && error.status === 401) {
        forceLogout(error.message || "Session expirée, reconnectez-vous.");
      }
      throw error;
    }
  },

  prepareHeaders() {
    const headers = {
      "X-CSRFToken": this.getCSRFToken(),
    };
    const jwtAccessToken = this.getJWTaccessToken();
    if (jwtAccessToken) {
      headers["Authorization"] = `Bearer ${jwtAccessToken}`;
    }
    return headers;
  },

  isTokenExpiringSoon(token) {
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      const currentTime = Math.floor(Date.now() / 1000);
      return (payload.exp - currentTime) < 300;
    } catch (error) {
      return true;
    }
  },

  async sendRequest(url, method, formData, headers) {
    return fetch(url, {
      method,
      headers,
      body: method !== "GET" && formData instanceof FormData ? formData : undefined,
    });
  },

  async handleUnauthorized(url, method, formData, customHeaders) {
    const newAccessToken = await this.handleTokenRefresh();
    if (newAccessToken) {
      const updatedHeaders = {
        ...this.prepareHeaders(),
        ...customHeaders,
        Authorization: `Bearer ${newAccessToken}`,
      };
      const response = await this.sendRequest(url, method, formData, updatedHeaders);
      if (!response.ok) {
        throw new HTTPError(
          response.statusText || "Échec après rafraîchissement du token",
          response.status
        );
      }
      return response;
    } else {
      throw new HTTPError("Impossible de rafraîchir le token.", 401);
    }
  },

  async handleTokenRefresh() {
    const jwtRefreshToken = this.getJWTrefreshToken();
    if (!jwtRefreshToken) {
      return null;
    }
    try {
      const formData = new FormData();
      formData.append("refresh_token", jwtRefreshToken);
      
      const headers = { "X-CSRFToken": this.getCSRFToken() };
      const jwtAccessToken = this.getJWTaccessToken();
      if (jwtAccessToken) {
        headers["Authorization"] = `Bearer ${jwtAccessToken}`;
      }

      const response = await fetch("/accounts/refreshJwt/", {
        method: "POST",
        body: formData,
        headers,
      });

      if (!response.ok) {
        forceLogout("Impossible de rafraîchir le token, veuillez vous reconnecter.");
        return null;
      }

      const data = await response.json();
      if (data && data.access_token) {
        const newAccessToken = data.access_token;
        localStorage.setItem("access_token", newAccessToken);
        return newAccessToken;
      } else {
        return null;
      }
    } catch (error) {
      return null;
    }
  },

  async handleResponse(response) {
    const contentType = response.headers.get("Content-Type");
    if (response.ok && contentType && contentType.includes("application/json")) {
      return response.json();
    } else if (!response.ok && contentType && contentType.includes("application/json")) {
      const errorData = await response.json();
      throw new HTTPError(errorData.message || "Erreur inconnue.", response.status);
    } else {
      throw new HTTPError("Réponse inattendue.", response.status);
    }
  },

  getCSRFToken() {
    const cookie = document.cookie.split(";").find(c => c.trim().startsWith("csrftoken="));
    return cookie ? cookie.trim().substring("csrftoken=".length) : "";
  },

  getJWTaccessToken() {
    return localStorage.getItem("access_token") || null;
  },

  getJWTrefreshToken() {
    return localStorage.getItem("refresh_token") || null;
  },

  async get(url) {
    return this.request(url, "GET");
  },

  async post(url, formData) {
    return this.request(url, "POST", formData);
  },

  async put(url, formData) {
    return this.request(url, "PUT", formData);
  },

  async delete(url) {
    return this.request(url, "DELETE");
  },
};

export async function requestGet(app, view) {
  const url = `/${app}/${view}/`;
  return Api.get(url);
}

export async function requestPost(app, view, formData) {
  const url = `/${app}/${view}/`;
  return Api.post(url, formData);
}

export async function requestDelete(app, view, resourceId) {
  const url = `/${app}/${view}/${resourceId}/`;
  return Api.delete(url);
}

export { RequestError, HTTPError, ContentTypeError, NetworkError } from "./apiErrors.js";
