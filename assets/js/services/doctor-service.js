/**
 * Care-OAU - Doctor Service
 * Manages doctor profiles, weekly schedules, operating hours, and capacity verification.
 * Connects to the backend doctors endpoint when available, and respects admin-published records.
 */

import { Storage } from '../core/storage.js';
import { APP_CONFIG } from '../core/config.js';
import { Api } from './api-client.js';

export const DoctorService = {
  /**
   * Fetch doctor records from API or local storage.
   * Distinguishes between:
   * - 'available': Real records returned
   * - 'empty': Real/valid data source confirmed empty (0 doctors)
   * - 'unavailable': Endpoint missing (404) or network failure with no admin records
   */
  async getDoctorAvailability() {
    // 1. If not strictly configured for mock/test data, attempt real backend API
    if (!APP_CONFIG.USE_MOCK_DATA) {
      try {
        const response = await Api.get('/doctors');
        const apiDoctors = Array.isArray(response)
          ? response
          : (Array.isArray(response?.data) ? response.data : null);

        if (apiDoctors !== null) {
          Storage.set(APP_CONFIG.STORAGE_KEYS.DOCTORS, apiDoctors);
          if (apiDoctors.length === 0) {
            return {
              status: 'empty',
              doctors: [],
              message: 'Doctor profiles and availability will appear here once the health centre team adds and publishes them. Please check back later.'
            };
          }
          return { status: 'available', doctors: apiDoctors };
        }
      } catch (err) {
        // Backend /doctors endpoint is not yet supported or returned an error
        // Check if admin has explicitly published doctor records in storage
        const localDoctors = Storage.get(APP_CONFIG.STORAGE_KEYS.DOCTORS, null);
        if (Array.isArray(localDoctors) && localDoctors.length > 0) {
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
    const localDoctors = Storage.get(APP_CONFIG.STORAGE_KEYS.DOCTORS, null);
    if (!localDoctors || localDoctors.length === 0) {
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
    return res.doctors || [];
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
    const doctors = Storage.get(APP_CONFIG.STORAGE_KEYS.DOCTORS, []);
    let updated;

    if (doctorData.id) {
      updated = doctors.map(d => d.id === doctorData.id ? { ...d, ...doctorData } : d);
    } else {
      const newDoc = {
        ...doctorData,
        id: `doc_${Date.now()}`,
        currentLoad: 0,
        isAvailable: true
      };
      updated = [...doctors, newDoc];
    }

    Storage.set(APP_CONFIG.STORAGE_KEYS.DOCTORS, updated);
    return { success: true, doctors: updated };
  }
};
