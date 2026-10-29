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

export const DAY_SHORT_TO_LONG = {
  Mon: 'Monday',
  Tue: 'Tuesday',
  Wed: 'Wednesday',
  Thu: 'Thursday',
  Fri: 'Friday',
  Sat: 'Saturday',
  Sun: 'Sunday'
};

export const DAY_LONG_TO_SHORT = {
  Monday: 'Mon',
  Tuesday: 'Tue',
  Wednesday: 'Wed',
  Thursday: 'Thu',
  Friday: 'Fri',
  Saturday: 'Sat',
  Sunday: 'Sun'
};

/**
 * Normalizes backend doctor records into unified frontend doctor model
 */
export function fromBackendDoctor(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const publicId = String(raw.publicId || raw.id || '').trim();
  const schedule = raw.schedule || {};
  const rawDays = schedule.workingDays || raw.workingDays || [];
  const workingDays = Array.isArray(rawDays)
    ? rawDays.map(d => DAY_SHORT_TO_LONG[d] || d)
    : [];

  const serviceId = raw.service?.publicId || raw.serviceId || '';
  const serviceName = raw.service?.name || raw.serviceName || raw.specialization || 'General Medical Consultation';
  const specialization = raw.specialization || serviceName;

  const rawStatus = raw.status ? String(raw.status).toLowerCase() : 'available';
  const isAvailable = rawStatus === 'available' || raw.isAvailable === true;

  const startTime = schedule.startTime || raw.startTime || '08:00:00';
  const endTime = schedule.endTime || raw.endTime || '16:00:00';
  const dailyCapacity = Number(schedule.dailyPatientLimit || raw.dailyCapacity || 25);
  const room = schedule.consultingRoom || raw.consultingRoom || raw.room || 'Consulting Room 1';

  return {
    id: publicId,
    publicId,
    name: raw.name || '',
    title: raw.title || 'Medical Doctor',
    specialization,
    serviceId,
    serviceName,
    service: raw.service || { publicId: serviceId, name: serviceName },
    workingDays,
    startTime: startTime.slice(0, 5),
    endTime: endTime.slice(0, 5),
    rawStartTime: startTime,
    rawEndTime: endTime,
    dailyCapacity,
    room,
    consultingRoom: room,
    status: rawStatus,
    isAvailable,
    currentLoad: raw.currentLoad || 0,
    isAdminCreated: true
  };
}

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
        let response = null;
        try {
          response = await Api.get('/admin/doctors');
        } catch {
          response = await Api.get('/doctors');
        }
        const rawList = response?.data?.doctors ?? (Array.isArray(response?.data) ? response.data : (Array.isArray(response) ? response : null));

        if (rawList !== null) {
          const apiDoctors = rawList.map(d => fromBackendDoctor(d) || d);
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
        // Backend /admin/doctors or /doctors endpoint is not yet supported or returned an error
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
   * Save or update doctor record (Used in Admin portal).
   * Attempts live backend mutation and maintains persistent fallback cache.
   */
  async saveDoctor(doctorData) {
    const doctors = this.purgeLegacyDemoDoctors();
    let updated;
    const publicId = doctorData.publicId || doctorData.id;

    if (!APP_CONFIG.USE_MOCK_DATA) {
      try {
        if (publicId && !publicId.startsWith('doc_admin_') && !publicId.startsWith('doc_local_')) {
          let updatedOnBackend = false;
          try {
            const shortDays = (doctorData.workingDays || []).map(d => DAY_LONG_TO_SHORT[d] || d);
            const patchPayload = {
              name: doctorData.name,
              title: doctorData.title || 'Medical Doctor',
              consultingRoom: doctorData.room || doctorData.consultingRoom
            };
            if (doctorData.serviceId) {
              patchPayload.service = { publicId: doctorData.serviceId };
            }
            if (doctorData.workingDays || doctorData.startTime || doctorData.endTime || doctorData.dailyCapacity) {
              patchPayload.schedule = {
                workingDays: shortDays,
                startTime: doctorData.startTime ? (doctorData.startTime.length === 5 ? doctorData.startTime + ':00' : doctorData.startTime) : '08:00:00',
                endTime: doctorData.endTime ? (doctorData.endTime.length === 5 ? doctorData.endTime + ':00' : doctorData.endTime) : '16:00:00',
                dailyPatientLimit: Number(doctorData.dailyCapacity) || 25,
                consultingRoom: doctorData.room || doctorData.consultingRoom
              };
            }
            await Api.patch(`/admin/doctors/${publicId}`, patchPayload);
            updatedOnBackend = true;
          } catch {
            // Fallback for legacy or mock-test routes
          }

          if (!updatedOnBackend) {
            await Api.patch(`/doctors/${publicId}/profile`, {
              name: doctorData.name,
              title: doctorData.title,
              specialization: doctorData.specialization,
              room: doctorData.room
            });
            if (doctorData.workingDays && doctorData.startTime && doctorData.endTime) {
              await Api.patch(`/doctors/${publicId}/schedule`, {
                workingDays: doctorData.workingDays,
                startTime: doctorData.startTime,
                endTime: doctorData.endTime,
                dailyCapacity: Number(doctorData.dailyCapacity) || 20
              });
            }
          }
        } else {
          let createdOnBackend = false;
          try {
            const shortDays = (doctorData.workingDays || ['Monday', 'Tuesday', 'Wednesday']).map(d => DAY_LONG_TO_SHORT[d] || d);
            const servicePublicId = doctorData.serviceId || 'srv_general';
            const postPayload = {
              name: doctorData.name,
              title: doctorData.title || 'Medical Doctor',
              service: { publicId: servicePublicId },
              workingDays: shortDays,
              startTime: doctorData.startTime ? (doctorData.startTime.length === 5 ? doctorData.startTime + ':00' : doctorData.startTime) : '08:00:00',
              endTime: doctorData.endTime ? (doctorData.endTime.length === 5 ? doctorData.endTime + ':00' : doctorData.endTime) : '16:00:00',
              dailyPatientLimit: Number(doctorData.dailyCapacity) || 25,
              consultingRoom: doctorData.room || doctorData.consultingRoom || 'Consulting Room 1'
            };
            const res = await Api.post('/admin/doctors', postPayload);
            const createdDoc = res?.data?.doctor || res?.data;
            if (createdDoc?.publicId) {
              doctorData.id = createdDoc.publicId;
              doctorData.publicId = createdDoc.publicId;
              createdOnBackend = true;
            }
          } catch {
            // Fallback to legacy POST /doctors
          }

          if (!createdOnBackend) {
            const res = await Api.post('/doctors', {
              name: doctorData.name,
              title: doctorData.title || 'Medical Officer',
              specialization: doctorData.specialization,
              room: doctorData.room || 'Consulting Room 1',
              workingDays: doctorData.workingDays || ['Monday', 'Tuesday', 'Wednesday'],
              startTime: doctorData.startTime || '08:00',
              endTime: doctorData.endTime || '16:00',
              dailyCapacity: Number(doctorData.dailyCapacity) || 20
            });
            const createdDoc = res?.data;
            if (createdDoc?.publicId) {
              await Api.patch(`/doctors/${createdDoc.publicId}/publish`);
              doctorData.id = createdDoc.publicId;
              doctorData.publicId = createdDoc.publicId;
            }
          }
        }
      } catch (err) {
        // Fallback to local storage persistence
      }
    }

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
  },

  /**
   * Explicitly publish a doctor draft
   */
  async publishDoctor(publicId) {
    try {
      await Api.patch(`/doctors/${publicId}/publish`);
    } catch (err) {
      // Fallback
    }
    const doctors = this.purgeLegacyDemoDoctors();
    const updated = doctors.map(d => (d.id === publicId || d.publicId === publicId) ? { ...d, status: 'published', isAvailable: true } : d);
    Storage.set(APP_CONFIG.STORAGE_KEYS.DOCTORS, updated);
    return { success: true, doctors: updated };
  },

  /**
   * Deactivate a doctor (preserves historical bookings)
   */
  async deactivateDoctor(publicId) {
    try {
      await Api.patch(`/doctors/${publicId}/deactivate`);
    } catch (err) {
      // Fallback
    }
    const doctors = this.purgeLegacyDemoDoctors();
    const updated = doctors.map(d => (d.id === publicId || d.publicId === publicId) ? { ...d, status: 'deactivated', isAvailable: false } : d);
    Storage.set(APP_CONFIG.STORAGE_KEYS.DOCTORS, updated);
    return { success: true, doctors: updated };
  },

  /**
   * Toggle temporary doctor availability
   */
  async toggleAvailability(publicId, isAvailable) {
    const cleanId = String(publicId || '').trim();
    if (!APP_CONFIG.USE_MOCK_DATA && cleanId) {
      try {
        await Api.patch(`/admin/doctors/${cleanId}/status`, {
          status: isAvailable ? 'available' : 'on_break'
        });
      } catch (err) {
        try {
          await Api.patch(`/doctors/${cleanId}/availability`, { isAvailable });
        } catch {}
      }
    }
    const doctors = this.purgeLegacyDemoDoctors();
    const updated = doctors.map(d => (d.id === cleanId || d.publicId === cleanId) ? { ...d, isAvailable, status: isAvailable ? 'available' : 'on_break' } : d);
    Storage.set(APP_CONFIG.STORAGE_KEYS.DOCTORS, updated);
    return { success: true, doctors: updated };
  },

  /**
   * Delete (soft-delete) a doctor using documented DELETE /admin/doctors/{publicId}
   */
  async deleteDoctor(publicId) {
    const cleanId = String(publicId || '').trim();
    if (!cleanId) throw new Error('Doctor publicId is required for deletion');

    if (!APP_CONFIG.USE_MOCK_DATA) {
      try {
        await Api.delete(`/admin/doctors/${cleanId}`);
      } catch (err) {
        console.warn(`[DoctorService] Backend DELETE /admin/doctors/${cleanId} failed:`, err.message);
      }
    }

    const doctors = this.purgeLegacyDemoDoctors();
    const updated = doctors.filter(d => d.id !== cleanId && d.publicId !== cleanId);
    Storage.set(APP_CONFIG.STORAGE_KEYS.DOCTORS, updated);
    return { success: true, doctors: updated };
  }
};
