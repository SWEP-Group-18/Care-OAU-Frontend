/**
 * Care-OAU - Unified API Client Layer
 * Prepares the frontend for seamless future integration with the Node.js + Express backend.
 * Provides standard HTTP verb abstractions (GET, POST, PUT, DELETE), header management,
 * JWT bearer injection, and automatic fallback to simulated mock workflows when in demonstration mode.
 */

import { APP_CONFIG } from '../core/config.js';
import { Storage } from '../core/storage.js';

class ApiClient {
  getBaseUrl() {
    return (APP_CONFIG.API_BASE_URL || '').replace(/\/+$/, '');
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
   * Generic request wrapper with credentials: 'include' for HttpOnly session cookies
   */
  async request(endpoint, options = {}) {
    if (APP_CONFIG.USE_MOCK_DATA) {
      console.info(`[Care-OAU Mock API] ${options.method || 'GET'} ${endpoint}`, options.body || {});
    }

    const baseUrl = this.getBaseUrl();
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const url = `${baseUrl}${cleanEndpoint}`;

    const config = {
      credentials: 'include',
      ...options,
      headers: this.getHeaders(options.headers)
    };

    if (options.body && typeof options.body === 'object' && !(options.body instanceof FormData)) {
      config.body = JSON.stringify(options.body);
    }

    try {
      const response = await fetch(url, config);
      let data = null;
      const contentType = response.headers.get('content-type') || '';
      
      if (contentType.includes('application/json')) {
        try {
          data = await response.json();
        } catch {
          data = { message: await response.text() };
        }
      } else {
        const text = await response.text();
        try {
          data = JSON.parse(text);
        } catch {
          data = { message: text };
        }
      }

      if (!response.ok) {
        let message = data?.message;
        if (data?.error?.details && Array.isArray(data.error.details)) {
          message = data.error.details.map(d => d.message).join('. ');
        }
        if (!message) {
          message = `HTTP Error ${response.status}: ${response.statusText}`;
        }

        const error = new Error(message);
        error.status = response.status;
        error.data = data;
        error.code = data?.error?.code;
        error.details = data?.error?.details || [];
        throw error;
      }

      return data;
    } catch (error) {
      // In mock mode, if network connection failed (no response status), handle safely
      if (APP_CONFIG.USE_MOCK_DATA && !error.status) {
        console.warn(`[Care-OAU Client] Live server not reachable at ${url}. Operating safely in local demonstration mode.`);
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
