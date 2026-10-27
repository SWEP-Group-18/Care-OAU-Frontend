/**
 * Care-OAU - Doctor Service
 * Manages doctor profiles, weekly schedules, operating hours, and capacity verification.
 * Connects to the backend doctors endpoint when available, and respects admin-published records.
 */

import { Storage } from '../core/storage.js';
import { APP_CONFIG } from '../core/config.js';
import { Api } from './api-client.js';

// Legacy demo doctors seeded in prototype stages that must be purged for every user
export const DEMO_DOCTOR_IDS = new Set(['doc_lab', 'doc_01', 'doc_02', 'doc_03', 'doc_04', 'doc_05']);
export const DEMO_DOCTOR_NAMES = new Set([
  'Dr. Mariam Sule',
  'Dr. O. A. Adeleke',
  'Dr. (Mrs) F. K. Babalola',
  'Dr. A. M. Ibrahim',
  'Dr. E. O. Okonjo',
  'Dr. (Mrs) C. Y. Bello'
]);

/**
 * Checks if a doctor record matches prototype demo data
 */
export function isDemoDoctor(doc) {
  if (!doc) return false;
  if (doc.isAdminCreated) return false;
  if (DEMO_DOCTOR_IDS.has(doc.id)) return true;
  if (DEMO_DOCTOR_NAMES.has(doc.name)) return true;
  return false;
}

/**
 * Filters out prototype demo doctors, keeping only real/admin-created records
 */
export function sanitizeDoctors(list) {
  if (!Array.isArray(list)) return [];
  return list.filter(doc => !isDemoDoctor(doc));
}

export const DoctorService = {
  /**
   * Purges residual prototype demo doctors from local storage so real users never see demo records.
   * Returns clean array of remaining real/admin-created doctors.
   */
  purgeLegacyDemoDoctors(provided = null) {
    const list = provided !== null ? provided : Storage.get(APP_CONFIG.STORAGE_KEYS.DOCTORS, null);
    if (!Array.isArray(list)) return [];
    const sanitized = sanitizeDoctors(list);
    if (sanitized.length !== list.length) {
      Storage.set(APP_CONFIG.STORAGE_KEYS.DOCTORS, sanitized);
    }
    return sanitized;
  },

  /**
   * Fetch doctor records from API or local storage.
   * Distinguishes between:
   * - 'available': Real records returned
   * - 'empty': Real/valid data source confirmed empty (0 doctors)
   * - 'unavailable': Endpoint missing (404) or network failure with no admin records
   */
  async getDoctorAvailability() {
    // Cleanse any legacy demo doctors from browser storage
    const localDoctors = this.purgeLegacyDemoDoctors();

    // 1. If not strictly configured for mock/test data, attempt real backend API
    if (!APP_CONFIG.USE_MOCK_DATA) {
      try {
        const response = await Api.get('/doctors');
        const apiDoctors = Array.isArray(response)
          ? response
          : (Array.isArray(response?.data) ? response.data : null);

        if (apiDoctors !== null) {
          const cleanApiDoctors = sanitizeDoctors(apiDoctors);
          Storage.set(APP_CONFIG.STORAGE_KEYS.DOCTORS, cleanApiDoctors);
          if (cleanApiDoctors.length === 0) {
            return {
              status: 'empty',
              doctors: [],
              message: 'Doctor profiles and availability will appear here once the health centre team adds and publishes them. Please check back later.'
            };
          }
          return { status: 'available', doctors: cleanApiDoctors };
        }
      } catch (err) {
        // Backend /doctors endpoint is not yet supported or returned an error
        // Check if admin has explicitly published doctor records in storage
        if (localDoctors.length > 0) {
          return { status: 'available', doctors: localDoctors };
        }

        return {
          status: 'unavailable',
          statusCode: err.status || 0,
          doctors: [],
          message: 'Doctor availability is not available right now. Please check back later.'
        };
      }
    }

    // 2. In local storage / test environment:
    if (localDoctors.length === 0) {
      return {
        status: 'empty',
        doctors: [],
        message: 'Doctor profiles and availability will appear here once the health centre team adds and publishes them. Please check back later.'
      };
    }

    return { status: 'available', doctors: localDoctors };
  },

  /**
   * Retrieve all doctors from data source
   */
  async getAllDoctors() {
    const res = await this.getDoctorAvailability();
    if (Array.isArray(res.doctors) && res.doctors.length > 0) {
      return res.doctors;
    }
    return this.purgeLegacyDemoDoctors();
  },

  /**
   * Get doctor by ID
   */
  async getDoctorById(id) {
    const doctors = await this.getAllDoctors();
    return doctors.find(d => d.id === id) || null;
  },

  /**
   * Filter doctors by day of week and/or search query
   */
  async getFilteredDoctors({ day = 'All', query = '', serviceId = '' } = {}) {
    const doctors = await this.getAllDoctors();
    const cleanQuery = query.toLowerCase().trim();

    return doctors.filter(doc => {
      // Day filter
      if (day !== 'All' && !(doc.workingDays || []).includes(day)) {
        return false;
      }

      // Service filter
      if (serviceId && doc.serviceId !== serviceId) {
        return false;
      }

      // Search query
      if (cleanQuery) {
        const matchName = (doc.name || '').toLowerCase().includes(cleanQuery);
        const matchSpec = (doc.specialization || '').toLowerCase().includes(cleanQuery);
        const matchTitle = (doc.title || '').toLowerCase().includes(cleanQuery);
        if (!matchName && !matchSpec && !matchTitle) return false;
      }

      return true;
    });
  },

  /**
   * Find alternative suitable doctors when a specific doctor's capacity is exhausted
   */
  async getAlternativeDoctors(serviceId, excludeDoctorId) {
    const doctors = await this.getAllDoctors();
    return doctors.filter(doc => 
      doc.id !== excludeDoctorId && 
      doc.serviceId === serviceId && 
      doc.isAvailable &&
      (doc.currentLoad < doc.dailyCapacity)
    );
  },

  /**
   * Save or update doctor record (Used in Admin portal)
   */
  async saveDoctor(doctorData) {
    const doctors = this.purgeLegacyDemoDoctors();
    let updated;

    if (doctorData.id) {
      updated = doctors.map(d => d.id === doctorData.id ? { ...d, ...doctorData, isAdminCreated: true } : d);
    } else {
      const newDoc = {
        ...doctorData,
        id: doctorData.id || `doc_admin_${Date.now()}`,
        isAdminCreated: true,
        currentLoad: 0,
        isAvailable: true
      };
      updated = [...doctors, newDoc];
    }

    Storage.set(APP_CONFIG.STORAGE_KEYS.DOCTORS, updated);
    return { success: true, doctors: updated };
  }
};
