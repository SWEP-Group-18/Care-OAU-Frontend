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

export const VALID_OPERATING_DAYS = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday'
];

/**
 * Normalizes day string or list to lowercase backend enum values
 */
export function normalizeOperatingDays(days) {
  if (!Array.isArray(days)) return [];
  return days
    .map(d => String(d || '').trim().toLowerCase())
    .filter(d => VALID_OPERATING_DAYS.includes(d));
}

/**
 * Normalizes day list to TitleCase for user-facing display ('Monday', 'Tuesday', ...)
 */
export function formatOperatingDaysDisplay(days) {
  if (!Array.isArray(days)) return [];
  return days
    .map(d => {
      const clean = String(d || '').trim().toLowerCase();
      if (!clean) return '';
      return clean.charAt(0).toUpperCase() + clean.slice(1);
    })
    .filter(Boolean);
}

/**
 * Normalizes time string to standard format (e.g. '08:00' -> '08:00:00' or vice versa)
 */
export function normalizeTimeString(timeStr, withSeconds = true) {
  if (!timeStr || typeof timeStr !== 'string') return withSeconds ? '08:00:00' : '08:00';
  const clean = timeStr.trim();
  const match = clean.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) return withSeconds ? '08:00:00' : '08:00';
  const hh = match[1].padStart(2, '0');
  const mm = match[2];
  const ss = match[3] || '00';
  return withSeconds ? `${hh}:${mm}:${ss}` : `${hh}:${mm}`;
}


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


/**
 * Maps a backend service record to the unified frontend service model.
 * Preserves canonical publicId, maps status <-> isActive, and normalizes schedule fields.
 */
export function fromBackendService(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const publicId = String(raw.publicId || raw.id || '').trim();
  const rawStatus = raw.status ? String(raw.status).trim().toLowerCase() : null;
  const status = rawStatus === 'closed' || raw.isActive === false ? 'closed' : 'open';
  const isActive = status === 'open';

  const opensAt = raw.opensAt ? normalizeTimeString(raw.opensAt, true) : (raw.startTime ? normalizeTimeString(raw.startTime, true) : '08:00:00');
  const closesAt = raw.closesAt ? normalizeTimeString(raw.closesAt, true) : (raw.endTime ? normalizeTimeString(raw.endTime, true) : '18:00:00');
  const startTime = normalizeTimeString(opensAt, false);
  const endTime = normalizeTimeString(closesAt, false);

  const rawDays = Array.isArray(raw.operatingDays) ? raw.operatingDays : [];
  const operatingDays = formatOperatingDaysDisplay(rawDays);
  const rawOperatingDays = normalizeOperatingDays(rawDays);

  return {
    publicId,
    id: publicId, // compatibility with components expecting .id
    name: raw.name || '',
    category: normalizeCategory(raw.category),
    categoryLabel: formatCategoryLabel(raw.category),
    description: raw.description || '',
    operatingDays,
    rawOperatingDays,
    opensAt,
    closesAt,
    startTime,
    endTime,
    dailyCapacity: Number(raw.dailyCapacity ?? raw.capacityPerDay ?? 50),
    requiresReferral: Boolean(raw.requiresReferral),
    status,
    isActive
  };
}

/**
 * Serializes service form/model data into the exact request body required by POST /admin/services.
 * Guarantees all 8 required fields per Swagger specification and omits frontend-only properties.
 */
export function toBackendCreatePayload(data = {}) {
  const operatingDays = normalizeOperatingDays(data.operatingDays || []);
  const opensAt = normalizeTimeString(data.opensAt || data.startTime || '08:00', true);
  const closesAt = normalizeTimeString(data.closesAt || data.endTime || '18:00', true);

  return {
    name: String(data.name || '').trim(),
    category: normalizeCategory(data.category),
    description: String(data.description || '').trim(),
    operatingDays,
    opensAt,
    closesAt,
    dailyCapacity: parseInt(data.dailyCapacity ?? data.capacityPerDay, 10) || 50,
    requiresReferral: Boolean(data.requiresReferral)
  };
}

/**
 * Serializes service changes into the exact body accepted by PATCH /admin/services/{publicId}.
 * Omits frontend-only keys such as id, publicId, isActive, status, startTime, and endTime.
 */
export function toBackendUpdatePayload(data = {}) {
  const payload = {};

  if (data.name !== undefined) {
    payload.name = String(data.name).trim();
  }
  if (data.category !== undefined) {
    payload.category = normalizeCategory(data.category);
  }
  if (data.description !== undefined) {
    payload.description = String(data.description).trim();
  }
  if (data.operatingDays !== undefined) {
    payload.operatingDays = normalizeOperatingDays(data.operatingDays);
  }
  if (data.opensAt !== undefined || data.startTime !== undefined) {
    payload.opensAt = normalizeTimeString(data.opensAt || data.startTime, true);
  }
  if (data.closesAt !== undefined || data.endTime !== undefined) {
    payload.closesAt = normalizeTimeString(data.closesAt || data.endTime, true);
  }
  if (data.dailyCapacity !== undefined || data.capacityPerDay !== undefined) {
    payload.dailyCapacity = parseInt(data.dailyCapacity ?? data.capacityPerDay, 10);
  }
  if (data.requiresReferral !== undefined) {
    payload.requiresReferral = Boolean(data.requiresReferral);
  }

  return payload;
}

export const MedicalService = {
  /**
   * Get all medical services from API or storage fallback.
   * Calls the documented GET /admin/services route and parses data.services envelope.
   */
  async getAllServices(options = {}) {
    const { forceRemote = false } = options;

    if (!APP_CONFIG.USE_MOCK_DATA) {
      try {
        const res = await Api.get('/admin/services');
        const rawList = res?.data?.services ?? (Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : null));
        if (rawList !== null) {
          const normalized = rawList.map(fromBackendService).filter(Boolean);
          Storage.set(APP_CONFIG.STORAGE_KEYS.SERVICES, normalized);
          return normalized;
        }
      } catch (err) {
        if (forceRemote) throw err;
        console.warn('[MedicalService] Failed to fetch services from /admin/services:', err.message);
        // Fallback to storage cache
      }
    }

    let services = Storage.get(APP_CONFIG.STORAGE_KEYS.SERVICES);
    if (!services) {
      if (APP_CONFIG.USE_MOCK_DATA) {
        services = INITIAL_SERVICES.map(fromBackendService);
        Storage.set(APP_CONFIG.STORAGE_KEYS.SERVICES, services);
      } else {
        services = [];
      }
    } else {
      services = Array.isArray(services) ? services.map(fromBackendService).filter(Boolean) : [];
    }
    return services;
  },

  /**
   * Get single service by public ID directly from API or cached list.
   * Calls documented GET /admin/services/{publicId}.
   */
  async getServiceByPublicId(publicId) {
    if (!publicId) return null;
    const cleanId = String(publicId).trim();

    if (!APP_CONFIG.USE_MOCK_DATA) {
      try {
        const res = await Api.get(`/admin/services/${cleanId}`);
        const raw = res?.data?.service || res?.data;
        if (raw) {
          const service = fromBackendService(raw);
          const cached = Storage.get(APP_CONFIG.STORAGE_KEYS.SERVICES, []);
          if (Array.isArray(cached)) {
            const index = cached.findIndex(s => s.publicId === cleanId || s.id === cleanId);
            if (index >= 0) {
              cached[index] = service;
            } else {
              cached.push(service);
            }
            Storage.set(APP_CONFIG.STORAGE_KEYS.SERVICES, cached);
          }
          return service;
        }
      } catch (err) {
        console.warn(`[MedicalService] Failed to fetch service ${cleanId} from /admin/services:`, err.message);
      }
    }

    const services = await this.getAllServices();
    return services.find(s => s.publicId === cleanId || s.id === cleanId) || null;
  },

  /**
   * Get service by ID (supports canonical publicId or legacy id)
   */
  async getServiceById(id) {
    return this.getServiceByPublicId(id);
  },

  /**
   * Creates a new clinical service.
   * Calls documented POST /admin/services with the validated 8-field payload.
   */
  async createService(serviceData) {
    const payload = toBackendCreatePayload(serviceData);

    if (!payload.name) {
      throw new Error('Service name is required');
    }
    if (!Array.isArray(payload.operatingDays) || payload.operatingDays.length === 0) {
      throw new Error('A service must have at least one operating day');
    }

    let createdService = null;

    if (!APP_CONFIG.USE_MOCK_DATA) {
      const res = await Api.post('/admin/services', payload);
      const raw = res?.data?.service || res?.data;
      if (raw) {
        createdService = fromBackendService(raw);
      }
    }

    if (!createdService) {
      // Mock mode or simulated local creation
      createdService = fromBackendService({
        ...payload,
        publicId: `srv_${Math.random().toString(36).slice(2, 11)}`,
        status: 'open',
        isActive: true
      });
    }

    const cached = await this.getAllServices();
    const updated = [...cached.filter(s => s.publicId !== createdService.publicId), createdService];
    Storage.set(APP_CONFIG.STORAGE_KEYS.SERVICES, updated);

    return {
      success: true,
      service: createdService,
      services: updated
    };
  },

  /**
   * Updates an existing clinical service.
   * Calls documented PATCH /admin/services/{publicId} with allowed update fields.
   */
  async updateService(publicId, serviceData) {
    const cleanId = String(publicId || serviceData?.publicId || serviceData?.id || '').trim();
    if (!cleanId) {
      throw new Error('Service publicId is required for update');
    }

    const payload = toBackendUpdatePayload(serviceData);
    if (Array.isArray(payload.operatingDays) && payload.operatingDays.length === 0) {
      throw new Error('A service must have at least one operating day');
    }

    let updatedService = null;

    if (!APP_CONFIG.USE_MOCK_DATA) {
      const res = await Api.patch(`/admin/services/${cleanId}`, payload);
      const raw = res?.data?.service || res?.data;
      if (raw) {
        updatedService = fromBackendService(raw);
      }
    }

    const cached = await this.getAllServices();
    const existing = cached.find(s => s.publicId === cleanId || s.id === cleanId);

    if (!updatedService) {
      // Mock mode fallback or simulated local update
      if (!existing) {
        throw new Error('Service not found');
      }
      updatedService = fromBackendService({
        ...existing,
        ...payload,
        publicId: cleanId,
        id: cleanId
      });
    }

    const updated = cached.map(s => (s.publicId === cleanId || s.id === cleanId) ? updatedService : s);
    Storage.set(APP_CONFIG.STORAGE_KEYS.SERVICES, updated);

    return {
      success: true,
      service: updatedService,
      services: updated
    };
  },

  /**
   * Save (create or update) a medical service.
   * Dispatches to createService or updateService based on the presence of publicId/id.
   */
  async saveService(serviceData) {
    if (!serviceData || typeof serviceData !== 'object') {
      throw new Error('Service data is required');
    }
    const publicId = serviceData.publicId || serviceData.id;
    if (publicId && !publicId.startsWith('srv_local_') && !publicId.startsWith('temp_')) {
      return this.updateService(publicId, serviceData);
    }
    return this.createService(serviceData);
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
