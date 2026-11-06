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
  const item = raw.doctor || raw;
  const publicId = String(item.publicId || item.id || '').trim();
  const schedule = item.schedule || {};
  const rawDays = schedule.workingDays || item.workingDays || [];
  const workingDays = Array.isArray(rawDays) && rawDays.length > 0
    ? rawDays.map(d => DAY_SHORT_TO_LONG[d] || d)
    : ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  const serviceId = item.service?.publicId || item.serviceId || '';
  const serviceName = item.service?.name || item.serviceName || item.specialization || 'General Medical Consultation';
  const specialization = item.specialization || serviceName;

  const rawStatus = item.status ? String(item.status).toLowerCase() : 'available';
  const isAvailable = rawStatus === 'available' || item.isAvailable === true;

  const startTime = schedule.startTime || item.startTime || item.workingHours?.start || '08:00:00';
  const endTime = schedule.endTime || item.endTime || item.workingHours?.end || '16:00:00';
  const dailyCapacity = Number(schedule.dailyPatientLimit || item.dailyCapacity || item.appointmentSlots?.total || 25);
  const room = schedule.consultingRoom || item.consultingRoom || item.room || 'Consulting Room 1';

  return {
    id: publicId,
    publicId,
    name: item.name || '',
    title: item.title || 'Medical Doctor',
    specialization,
    serviceId,
    serviceName,
    service: item.service || { publicId: serviceId, name: serviceName },
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
    currentLoad: item.currentLoad || 0,
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
        const user = Storage.get(APP_CONFIG.STORAGE_KEYS.AUTH_USER);
        let response = null;
        if (user?.role === 'admin') {
          response = await Api.get('/admin/doctors');
        } else {
          try {
            response = await Api.get('/doctors');
          } catch {
            response = await Api.get('/admin/doctors').catch(() => null);
          }
        }
        const rawList = response?.data?.doctors ?? (Array.isArray(response?.data) ? response.data : (Array.isArray(response) ? response : null));

        if (rawList !== null) {
          const apiDoctors = rawList.map(d => fromBackendDoctor(d) || d);
          const cleanApiDoctors = sanitizeDoctors(apiDoctors);

          // Preserve any locally created admin doctors that may not be present in remote query
          const remoteIds = new Set(cleanApiDoctors.map(d => d.publicId || d.id));
          const localAdminDoctors = localDoctors.filter(d => d.isAdminCreated && !remoteIds.has(d.publicId || d.id));
          const merged = [...cleanApiDoctors, ...localAdminDoctors];

          Storage.set(APP_CONFIG.STORAGE_KEYS.DOCTORS, merged);
          if (merged.length === 0) {
            return {
              status: 'empty',
              doctors: [],
              message: 'Doctor profiles and availability will appear here once the health centre team adds and publishes them. Please check back later.'
            };
          }
          return { status: 'available', doctors: merged };
        }
      } catch (err) {
        // Backend /admin/doctors returned 403 (for student users) or was unavailable.
        // For students, doctor availability is provided via GET /appointments/slots.
        try {
          const servicesRes = await Api.get('/services').catch(() => null);
          const servicesList = servicesRes?.data?.services ?? (Array.isArray(servicesRes?.data) ? servicesRes.data : []);
          const today = new Date().toISOString().slice(0, 10);
          const targetServices = servicesList.length > 0 ? servicesList : [{ publicId: 'srv_7tVzVRGyLC', name: 'General Medical Consultation' }];
          const doctorsMap = new Map();

          for (const srv of targetServices) {
            try {
              const slotsRes = await Api.get(`/appointments/slots?servicePublicId=${encodeURIComponent(srv.publicId)}&date=${today}`);
              const slots = slotsRes?.data?.slots || [];
              for (const slot of slots) {
                if (!slot.doctor?.publicId) continue;
                const dId = slot.doctor.publicId;
                if (!doctorsMap.has(dId)) {
                  doctorsMap.set(dId, {
                    id: dId,
                    publicId: dId,
                    name: slot.doctor.name,
                    title: slot.doctor.title || 'Medical Doctor',
                    serviceId: srv.publicId,
                    serviceName: srv.name || 'General Medical Consultation',
                    specialization: srv.name || 'General Medical Consultation',
                    service: { publicId: srv.publicId, name: srv.name },
                    isAvailable: slot.status === 'available',
                    status: 'available',
                    startTime: (slot.startTime || '08:00').slice(0, 5),
                    endTime: (slot.endTime || '16:00').slice(0, 5),
                    dailyCapacity: 25,
                    room: 'Consulting Room',
                    consultingRoom: 'Consulting Room',
                    workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
                    isAdminCreated: true
                  });
                } else {
                  const doc = doctorsMap.get(dId);
                  const end = (slot.endTime || '').slice(0, 5);
                  if (end && end > doc.endTime) {
                    doc.endTime = end;
                  }
                }
              }
            } catch {}
          }

          if (doctorsMap.size > 0) {
            const slotDoctors = Array.from(doctorsMap.values());
            Storage.set(APP_CONFIG.STORAGE_KEYS.DOCTORS, slotDoctors);
            return { status: 'available', doctors: slotDoctors };
          }
        } catch {}

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
   * Calls documented POST /admin/doctors (create) or PATCH /admin/doctors/{publicId} (update).
   */
  async saveDoctor(doctorData) {
    const doctors = this.purgeLegacyDemoDoctors();
    const publicId = doctorData.publicId || doctorData.id;
    let createdOnBackend = false;
    let updatedOnBackend = false;

    // Convert workingDays to short days required by backend enum ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    const shortDays = (doctorData.workingDays || ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'])
      .map(d => DAY_LONG_TO_SHORT[d] || (typeof d === 'string' ? d.slice(0, 3) : 'Mon'));

    // Format start and end times to 24-hour HH:mm:ss
    const toSeconds = (t, fallback) => {
      if (!t) return fallback;
      const s = String(t).trim();
      if (/^\d{2}:\d{2}:\d{2}$/.test(s)) return s;
      if (/^\d{2}:\d{2}$/.test(s)) return `${s}:00`;
      return fallback;
    };
    const startTimeFormatted = toSeconds(doctorData.startTime, '08:00:00');
    const endTimeFormatted = toSeconds(doctorData.endTime, '16:00:00');
    const dailyLimit = parseInt(doctorData.dailyCapacity, 10) || 25;
    const room = String(doctorData.room || doctorData.consultingRoom || 'Consulting Room 1').trim();

    // Resolve clinical service public ID
    let servicePublicId = doctorData.serviceId || doctorData.service?.publicId;
    const cachedServices = Storage.get(APP_CONFIG.STORAGE_KEYS.SERVICES, []);
    if (Array.isArray(cachedServices) && cachedServices.length > 0) {
      const matched = cachedServices.find(s => 
        (s.publicId && (s.publicId === servicePublicId || s.id === servicePublicId)) ||
        (s.name && doctorData.specialization && s.name.toLowerCase() === doctorData.specialization.toLowerCase())
      );
      if (matched?.publicId) {
        servicePublicId = matched.publicId;
      }
    }

    if (!APP_CONFIG.USE_MOCK_DATA) {
      if (publicId && !publicId.startsWith('doc_admin_') && !publicId.startsWith('doc_local_')) {
        // UPDATE existing doctor on backend: PATCH /admin/doctors/{publicId}
        const patchPayload = {
          name: String(doctorData.name).trim(),
          title: String(doctorData.title || 'Medical Doctor').trim(),
          consultingRoom: room,
          schedule: {
            workingDays: shortDays,
            startTime: startTimeFormatted,
            endTime: endTimeFormatted,
            dailyPatientLimit: dailyLimit,
            consultingRoom: room
          }
        };
        if (servicePublicId) {
          patchPayload.service = { publicId: servicePublicId };
        }

        try {
          const res = await Api.patch(`/admin/doctors/${publicId}`, patchPayload);
          const updatedDoc = res?.data?.doctor || res?.data;
          if (updatedDoc) {
            updatedOnBackend = true;
          }
        } catch (patchErr) {
          console.error('[DoctorService] PATCH /admin/doctors error:', patchErr);
          return {
            success: false,
            message: patchErr.message || 'Unable to update doctor profile on server.',
            error: patchErr
          };
        }
      } else {
        // CREATE new doctor on backend: POST /admin/doctors
        const postPayload = {
          name: String(doctorData.name).trim(),
          title: String(doctorData.title || 'Medical Doctor').trim(),
          service: { publicId: servicePublicId },
          workingDays: shortDays,
          startTime: startTimeFormatted,
          endTime: endTimeFormatted,
          dailyPatientLimit: dailyLimit,
          consultingRoom: room
        };

        try {
          const res = await Api.post('/admin/doctors', postPayload);
          const createdDoc = res?.data?.doctor || res?.data;
          if (createdDoc?.publicId) {
            doctorData.id = createdDoc.publicId;
            doctorData.publicId = createdDoc.publicId;
            createdOnBackend = true;
          }
        } catch (postErr) {
          console.error('[DoctorService] POST /admin/doctors error:', postErr);
          return {
            success: false,
            message: postErr.message || 'Unable to save physician to server database.',
            error: postErr
          };
        }
      }
    }

    const doctorId = doctorData.publicId || doctorData.id || `doc_admin_${Date.now()}`;
    const normalizedDoctor = {
      ...doctorData,
      id: doctorId,
      publicId: doctorId,
      isAdminCreated: true,
      currentLoad: doctorData.currentLoad || 0,
      isAvailable: doctorData.isAvailable !== false,
      status: doctorData.status || 'available',
      workingDays: (doctorData.workingDays || ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'])
        .map(d => DAY_SHORT_TO_LONG[d] || d),
      startTime: startTimeFormatted.slice(0, 5),
      endTime: endTimeFormatted.slice(0, 5),
      rawStartTime: startTimeFormatted,
      rawEndTime: endTimeFormatted,
      dailyCapacity: dailyLimit,
      room,
      consultingRoom: room,
      specialization: doctorData.specialization || doctorData.serviceName || 'General Medical Consultation'
    };

    let updated;
    const existingIndex = doctors.findIndex(d => 
      (d.id && (d.id === doctorId || d.id === publicId)) || 
      (d.publicId && (d.publicId === doctorId || d.publicId === publicId))
    );

    if (existingIndex >= 0) {
      updated = [...doctors];
      updated[existingIndex] = { ...doctors[existingIndex], ...normalizedDoctor };
    } else {
      updated = [...doctors, normalizedDoctor];
    }

    Storage.set(APP_CONFIG.STORAGE_KEYS.DOCTORS, updated);
    return { success: true, doctor: normalizedDoctor, doctors: updated, createdOnBackend, updatedOnBackend };
  },

  /**
   * Update doctor attendance status using documented PATCH /admin/doctors/{publicId}/status
   */
  async updateDoctorStatus(publicId, status) {
    const cleanId = String(publicId || '').trim();
    if (!cleanId) throw new Error('Doctor publicId is required to update status');

    const statusMap = {
      'available': 'available',
      'Available': 'available',
      'in_consultation': 'in_consultation',
      'In Consultation': 'in_consultation',
      'on_break': 'on_break',
      'On Break': 'on_break',
      'arriving_soon': 'arriving_soon',
      'Arriving Soon': 'arriving_soon',
      'off_duty': 'off_duty',
      'Off Duty': 'off_duty',
      'on_leave': 'on_leave',
      'On Leave': 'on_leave'
    };
    const backendStatus = statusMap[status] || 'available';

    if (!APP_CONFIG.USE_MOCK_DATA) {
      await Api.patch(`/admin/doctors/${cleanId}/status`, { status: backendStatus });
    }

    const doctors = this.purgeLegacyDemoDoctors();
    const updated = doctors.map(d => (d.id === cleanId || d.publicId === cleanId) ? { ...d, status: backendStatus, isAvailable: backendStatus === 'available' } : d);
    Storage.set(APP_CONFIG.STORAGE_KEYS.DOCTORS, updated);
    return { success: true, doctors: updated, status: backendStatus };
  },

  /**
   * Toggle temporary doctor availability
   */
  async toggleAvailability(publicId, isAvailable) {
    return this.updateDoctorStatus(publicId, isAvailable ? 'available' : 'on_break');
  },

  /**
   * Publish a doctor roster
   */
  async publishDoctor(publicId) {
    return this.updateDoctorStatus(publicId, 'available');
  },

  /**
   * Deactivate a doctor (preserves historical bookings)
   */
  async deactivateDoctor(publicId) {
    return this.updateDoctorStatus(publicId, 'off_duty');
  },

  /**
   * Delete (soft-delete) a doctor using documented DELETE /admin/doctors/{publicId}
   */
  async deleteDoctor(publicId) {
    const cleanId = String(publicId || '').trim();
    if (!cleanId) throw new Error('Doctor publicId is required for deletion');

    if (!APP_CONFIG.USE_MOCK_DATA) {
      await Api.delete(`/admin/doctors/${cleanId}`);
    }

    const doctors = this.purgeLegacyDemoDoctors();
    const updated = doctors.filter(d => d.id !== cleanId && d.publicId !== cleanId);
    Storage.set(APP_CONFIG.STORAGE_KEYS.DOCTORS, updated);
    return { success: true, doctors: updated };
  }
};
