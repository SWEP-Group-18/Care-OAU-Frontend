/**
 * Care-OAU - Doctor Availability & Admin-Driven Verification Test
 * Verifies that:
 * 1. Missing doctors endpoint shows unavailable state ("Doctor availability is not available right now. Please check back later.")
 * 2. Network failures show unavailable state without falling back to demo records
 * 3. Supported empty backend response shows empty state ("No doctors available yet")
 * 4. Supported backend response with real records renders those records
 * 5. Admin-published records are reflected dynamically
 * 6. No fictional/hardcoded doctors are returned in production
 */

import assert from 'node:assert/strict';

// Set up mock window and localStorage environment for Node.js
const storageMap = new Map();
globalThis.window = {
  localStorage: {
    getItem: key => storageMap.get(key) ?? null,
    setItem: (key, value) => storageMap.set(key, String(value)),
    removeItem: key => storageMap.delete(key),
    clear: () => storageMap.clear()
  },
  location: { hostname: 'localhost', search: '' }
};

const { Storage } = await import('../assets/js/core/storage.js');
const { APP_CONFIG } = await import('../assets/js/core/config.js');
const { DoctorService } = await import('../assets/js/services/doctor-service.js');
const { Api } = await import('../assets/js/services/api-client.js');

// Save original Api.get
const originalApiGet = Api.get.bind(Api);

try {
  // Test 1: Missing doctors endpoint (404) with no local admin records
  Storage.remove(APP_CONFIG.STORAGE_KEYS.DOCTORS);
  Api.get = async (endpoint) => {
    if (endpoint === '/doctors') {
      const err = new Error('HTTP Error 404: Not Found');
      err.status = 404;
      throw err;
    }
    return originalApiGet(endpoint);
  };

  const unavailableRes = await DoctorService.getDoctorAvailability();
  assert.equal(unavailableRes.status, 'unavailable', 'Missing endpoint must return unavailable status');
  assert.equal(unavailableRes.doctors.length, 0, 'Missing endpoint must not return fictional doctors');
  assert.ok(unavailableRes.message.includes('Doctor availability is not available right now'), 'Must display unavailable message');

  // Test 2: Network failure with no local admin records
  Api.get = async (endpoint) => {
    if (endpoint === '/doctors') {
      const err = new Error('Failed to fetch');
      throw err;
    }
    return originalApiGet(endpoint);
  };

  const netErrorRes = await DoctorService.getDoctorAvailability();
  assert.equal(netErrorRes.status, 'unavailable', 'Network failure must return unavailable status');
  assert.equal(netErrorRes.doctors.length, 0, 'Network failure must not inject demo doctor cards');
  assert.ok(netErrorRes.message.includes('Doctor availability is not available right now'), 'Must display unavailable message on network failure');

  // Test 3: Supported API response with empty doctor list
  Api.get = async (endpoint) => {
    if (endpoint === '/doctors') {
      return { success: true, data: [] };
    }
    return originalApiGet(endpoint);
  };

  const emptyRes = await DoctorService.getDoctorAvailability();
  assert.equal(emptyRes.status, 'empty', 'Supported response with 0 records must return empty status');
  assert.equal(emptyRes.doctors.length, 0, 'Empty response must have 0 doctors');
  assert.ok(emptyRes.message.includes('Doctor profiles and availability will appear here'), 'Must display expected empty state guidance');

  // Test 4: Supported API response with real records
  const realDoctor = {
    id: 'doc_admin_001',
    name: 'Dr. Kehinde Falope',
    title: 'Consultant Physician',
    specialization: 'General Medical Consultation',
    workingDays: ['Monday', 'Wednesday', 'Friday'],
    startTime: '08:00',
    endTime: '15:00',
    dailyCapacity: 20,
    currentLoad: 2,
    isAvailable: true,
    room: 'Consulting Room 2'
  };

  Api.get = async (endpoint) => {
    if (endpoint === '/doctors') {
      return { success: true, data: [realDoctor] };
    }
    return originalApiGet(endpoint);
  };

  const populatedRes = await DoctorService.getDoctorAvailability();
  assert.equal(populatedRes.status, 'available', 'Supported response with records must return available status');
  assert.equal(populatedRes.doctors.length, 1, 'Must return the returned doctor records');
  assert.equal(populatedRes.doctors[0].name, 'Dr. Kehinde Falope');

  // Test 5: Admin adds/updates doctor when backend endpoint is not yet supported
  // Reset API to 404
  Api.get = async (endpoint) => {
    if (endpoint === '/doctors') {
      const err = new Error('HTTP Error 404: Not Found');
      err.status = 404;
      throw err;
    }
    return originalApiGet(endpoint);
  };

  const newAdminDoctor = {
    name: 'Dr. Olufemi Adebayo',
    title: 'Senior Dental Surgeon',
    specialization: 'Dental Care & Surgery',
    workingDays: ['Tuesday', 'Thursday'],
    startTime: '09:00',
    endTime: '14:00',
    dailyCapacity: 15,
    room: 'Dental Suite 1'
  };

  const saveRes = await DoctorService.saveDoctor(newAdminDoctor);
  assert.ok(saveRes.success, 'Admin doctor save must succeed');
  assert.equal(saveRes.doctors.length, 2, 'Doctor must be appended to admin records');

  // Reflect admin changes in student view
  const adminPublishedRes = await DoctorService.getDoctorAvailability();
  assert.equal(adminPublishedRes.status, 'available', 'Admin published records must surface to students');
  assert.equal(adminPublishedRes.doctors.length, 2);
  const foundDoctor = adminPublishedRes.doctors.find(d => d.name === 'Dr. Olufemi Adebayo');
  assert.ok(foundDoctor, 'Admin doctor must be retrievable');
  assert.equal(foundDoctor.specialization, 'Dental Care & Surgery');

  console.log('PASS: missing 404 endpoint unavailable state, network failure resilience, supported empty state, real record rendering, and admin-driven reflection.');
} finally {
  Api.get = originalApiGet;
}
