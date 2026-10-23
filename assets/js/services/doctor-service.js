/**
 * Care-OAU - Doctor Service
 * Manages doctor profiles, weekly schedules, operating hours, and capacity verification.
 */

import { Storage } from '../core/storage.js';
import { APP_CONFIG } from '../core/config.js';
import { INITIAL_DOCTORS } from '../data/mock-data.js';

export const DoctorService = {
  /**
   * Retrieve all doctors from storage
   */
  async getAllDoctors() {
    let doctors = Storage.get(APP_CONFIG.STORAGE_KEYS.DOCTORS);
    if (!doctors) {
      doctors = INITIAL_DOCTORS;
      Storage.set(APP_CONFIG.STORAGE_KEYS.DOCTORS, doctors);
    }
    return doctors;
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
        const matchName = doc.name.toLowerCase().includes(cleanQuery);
        const matchSpec = doc.specialization.toLowerCase().includes(cleanQuery);
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
    const doctors = await this.getAllDoctors();
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
