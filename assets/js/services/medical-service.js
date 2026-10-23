/**
 * Care-OAU - Medical Service Management API Service
 * Handles medical services, operating times, referral policies and daily capacity limits.
 */

import { Storage } from '../core/storage.js';
import { APP_CONFIG } from '../core/config.js';
import { INITIAL_SERVICES } from '../data/mock-data.js';

export const MedicalService = {
  /**
   * Get all medical services
   */
  async getAllServices() {
    let services = Storage.get(APP_CONFIG.STORAGE_KEYS.SERVICES);
    if (!services) {
      services = INITIAL_SERVICES;
      Storage.set(APP_CONFIG.STORAGE_KEYS.SERVICES, services);
    }
    return services;
  },

  /**
   * Get service by ID
   */
  async getServiceById(id) {
    const services = await this.getAllServices();
    return services.find(s => s.id === id) || null;
  },

  /**
   * Create or update a medical service
   */
  async saveService(serviceData) {
    const services = await this.getAllServices();
    let updated;

    if (serviceData.id) {
      updated = services.map(s => s.id === serviceData.id ? { ...s, ...serviceData } : s);
    } else {
      const newService = {
        ...serviceData,
        id: `srv_${Date.now()}`,
        isActive: true
      };
      updated = [...services, newService];
    }

    Storage.set(APP_CONFIG.STORAGE_KEYS.SERVICES, updated);
    return { success: true, services: updated };
  },

  /**
   * Toggle service active status
   */
  async toggleStatus(id) {
    const services = await this.getAllServices();
    const updated = services.map(s => {
      if (s.id === id) {
        return { ...s, isActive: !s.isActive };
      }
      return s;
    });

    Storage.set(APP_CONFIG.STORAGE_KEYS.SERVICES, updated);
    return { success: true };
  }
};
