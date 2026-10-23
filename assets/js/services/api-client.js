/**
 * Care-OAU - Unified API Client Layer
 * Prepares the frontend for seamless future integration with the Node.js + Express backend.
 * Provides standard HTTP verb abstractions (GET, POST, PUT, DELETE), header management,
 * JWT bearer injection, and automatic fallback to simulated mock workflows when in demonstration mode.
 */

import { APP_CONFIG } from '../core/config.js';
import { Storage } from '../core/storage.js';

class ApiClient {
  constructor() {
    this.baseUrl = APP_CONFIG.API_BASE_URL;
  }

  /**
   * Build request headers including authorization bearer token if logged in
   */
  getHeaders(customHeaders = {}) {
    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...customHeaders
    };

    const token = Storage.get(APP_CONFIG.STORAGE_KEYS.AUTH_TOKEN);
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    return headers;
  }

  /**
   * Generic request wrapper
   */
  async request(endpoint, options = {}) {
    // If in prototype mock mode, log for developers and proceed
    if (APP_CONFIG.USE_MOCK_DATA) {
      console.info(`[Care-OAU Mock API] ${options.method || 'GET'} ${endpoint}`, options.body || {});
    }

    const url = `${this.baseUrl}${endpoint.startsWith('/') ? endpoint : '/' + endpoint}`;
    const config = {
      ...options,
      headers: this.getHeaders(options.headers)
    };

    if (options.body && typeof options.body === 'object' && !(options.body instanceof FormData)) {
      config.body = JSON.stringify(options.body);
    }

    try {
      const response = await fetch(url, config);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || `HTTP Error ${response.status}: ${response.statusText}`);
      }

      return data;
    } catch (error) {
      // In mock mode, fetch might fail if no live express server is running; return mock handled response
      if (APP_CONFIG.USE_MOCK_DATA) {
        console.warn(`[Care-OAU Client] Live server not found at ${url}. Operating safely in local demonstration mode.`);
        return { mockHandled: true, error: error.message };
      }
      throw error;
    }
  }

  get(endpoint, headers = {}) {
    return this.request(endpoint, { method: 'GET', headers });
  }

  post(endpoint, body = {}, headers = {}) {
    return this.request(endpoint, { method: 'POST', body, headers });
  }

  put(endpoint, body = {}, headers = {}) {
    return this.request(endpoint, { method: 'PUT', body, headers });
  }

  delete(endpoint, headers = {}) {
    return this.request(endpoint, { method: 'DELETE', headers });
  }
}

export const Api = new ApiClient();
