/**
 * Care-OAU - Storage Service
 * Provides safe localStorage abstraction with fallback and type handling.
 * NOTE: For demonstration purposes only. Sensitive data should never be
 * permanently saved unencrypted in production.
 */

class StorageService {
  constructor() {
    this.memoryStorage = new Map();
    this.isStorageAvailable = this.checkAvailability();
  }

  checkAvailability() {
    try {
      const testKey = '__storage_test__';
      window.localStorage.setItem(testKey, testKey);
      window.localStorage.removeItem(testKey);
      return true;
    } catch (e) {
      console.warn('Care-OAU: localStorage unavailable. Using in-memory fallback.');
      return false;
    }
  }

  get(key, defaultValue = null) {
    try {
      if (this.isStorageAvailable) {
        const item = window.localStorage.getItem(key);
        return item ? JSON.parse(item) : defaultValue;
      }
      return this.memoryStorage.has(key) ? this.memoryStorage.get(key) : defaultValue;
    } catch (e) {
      console.error(`Error reading key "${key}" from storage:`, e);
      return defaultValue;
    }
  }

  set(key, value) {
    try {
      const serialized = JSON.stringify(value);
      if (this.isStorageAvailable) {
        window.localStorage.setItem(key, serialized);
      } else {
        this.memoryStorage.set(key, value);
      }
      return true;
    } catch (e) {
      console.error(`Error writing key "${key}" to storage:`, e);
      return false;
    }
  }

  remove(key) {
    try {
      if (this.isStorageAvailable) {
        window.localStorage.removeItem(key);
      } else {
        this.memoryStorage.delete(key);
      }
    } catch (e) {
      console.error(`Error removing key "${key}" from storage:`, e);
    }
  }

  clear() {
    try {
      if (this.isStorageAvailable) {
        window.localStorage.clear();
      }
      this.memoryStorage.clear();
    } catch (e) {
      console.error('Error clearing storage:', e);
    }
  }
}

export const Storage = new StorageService();
