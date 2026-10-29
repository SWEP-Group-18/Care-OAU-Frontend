/**
 * Care-OAU - Medical Service Management API Service
 * Handles medical services, operating times, referral policies and daily capacity limits.
 */

import { Storage } from '../core/storage.js';
import { APP_CONFIG } from '../core/config.js';
import { INITIAL_SERVICES } from '../data/mock-data.js';
import { Api } from './api-client.js';

export const VALID_SERVICE_CATEGORIES = [
  'general_medicine',
  'dental',
  'optometry',
  'laboratory',
  'mental_health',
  'other'
];

/**
 * Normalizes input category to valid backend enum value
 */
export function normalizeCategory(category) {
  if (!category || typeof category !== 'string') return 'other';
  const clean = category.trim().toLowerCase();
  if (VALID_SERVICE_CATEGORIES.includes(clean)) return clean;

  if (clean.includes('general') || clean.includes('outpatient')) return 'general_medicine';
  if (clean.includes('dent')) return 'dental';
  if (clean.includes('opt') || clean.includes('eye')) return 'optometry';
  if (clean.includes('lab') || clean.includes('diagnost')) return 'laboratory';
  if (clean.includes('mental') || clean.includes('counsel') || clean.includes('psych')) return 'mental_health';
  return 'other';
}

/**
 * Provides a human-readable display label for a service category
 */
export function formatCategoryLabel(category) {
  const norm = normalizeCategory(category);
  switch (norm) {
    case 'general_medicine': return 'General Medical Consultation';
    case 'dental': return 'Dental Care & Surgery';
    case 'optometry': return 'Optometry & Eye Clinic';
    case 'laboratory': return 'Diagnostic Laboratory Services';
    case 'mental_health': return 'Student Mental Health & Counselling';
    case 'other':
    default:
      return 'Other Clinical Services';
  }
}


export const MedicalService = {
  /**
   * Get all medical services from API or storage fallback
   */
  async getAllServices() {
    if (!APP_CONFIG.USE_MOCK_DATA) {
      try {
        const res = await Api.get('/services');
        const items = Array.isArray(res) ? res : (Array.isArray(res?.data) ? res.data : null);
        if (items !== null) {
          Storage.set(APP_CONFIG.STORAGE_KEYS.SERVICES, items);
          return items;
        }
      } catch (err) {
        // Fallback to storage
      }
    }

    let services = Storage.get(APP_CONFIG.STORAGE_KEYS.SERVICES);
    if (!services) {
      if (APP_CONFIG.USE_MOCK_DATA) {
        services = INITIAL_SERVICES;
        Storage.set(APP_CONFIG.STORAGE_KEYS.SERVICES, services);
      } else {
        services = [];
      }
    }
    return services;
  },

  /**
   * Get service by ID
   */
  async getServiceById(id) {
    const services = await this.getAllServices();
    return services.find(s => s.id === id || s.publicId === id) || null;
  },

  /**
   * Create or update a medical service
   */
  async saveService(serviceData) {
    const services = await this.getAllServices();
    const publicId = serviceData.publicId || serviceData.id;
    let updated;

    if (!APP_CONFIG.USE_MOCK_DATA) {
      try {
        if (publicId && !publicId.startsWith('srv_local_')) {
          await Api.patch(`/services/${publicId}`, {
            name: serviceData.name,
            description: serviceData.description,
            operatingHours: serviceData.operatingHours,
            requiresReferral: serviceData.requiresReferral,
            capacityPerDay: serviceData.capacityPerDay
          });
        } else {
          const res = await Api.post('/services', {
            name: serviceData.name,
            description: serviceData.description,
            operatingHours: serviceData.operatingHours,
            requiresReferral: serviceData.requiresReferral,
            capacityPerDay: serviceData.capacityPerDay
          });
          if (res?.data?.publicId) {
            serviceData.id = res.data.publicId;
            serviceData.publicId = res.data.publicId;
          }
        }
      } catch (err) {
        // Fallback to local storage
      }
    }

    if (serviceData.id) {
      updated = services.map(s => (s.id === serviceData.id || s.publicId === serviceData.id) ? { ...s, ...serviceData } : s);
    } else {
      const newService = {
        ...serviceData,
        id: serviceData.id || `srv_${Date.now()}`,
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
    if (!APP_CONFIG.USE_MOCK_DATA) {
      try {
        await Api.patch(`/services/${id}/status`);
      } catch (err) {
        // Fallback
      }
    }

    const services = await this.getAllServices();
    const updated = services.map(s => {
      if (s.id === id || s.publicId === id) {
        return { ...s, isActive: !s.isActive };
      }
      return s;
    });

    Storage.set(APP_CONFIG.STORAGE_KEYS.SERVICES, updated);
    return { success: true, services: updated };
  }
};
