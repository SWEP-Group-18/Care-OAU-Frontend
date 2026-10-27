/**
 * Care-OAU - Admin Doctor Modal Unit Test
 * Verifies that openDoctorModal populates services without throwing ReferenceError: INITIAL_SERVICES is not defined
 */

import assert from 'node:assert/strict';

// Set up mock DOM and storage environment for Node.js
const storageMap = new Map();
const makeMockElement = () => ({
  id: '',
  className: '',
  innerHTML: '',
  textContent: '',
  value: '',
  appendChild: () => {},
  setAttribute: () => {},
  getAttribute: () => null,
  querySelector: () => null,
  querySelectorAll: () => [],
  classList: { add: () => {}, remove: () => {} }
});

const elements = {
  'doctor-modal-title': makeMockElement(),
  'doc-id': makeMockElement(),
  'doc-name': makeMockElement(),
  'doc-title': makeMockElement(),
  'doc-service': makeMockElement(),
  'doc-start-time': makeMockElement(),
  'doc-end-time': makeMockElement(),
  'doc-capacity': makeMockElement(),
  'doc-room': makeMockElement(),
  'doctor-form-modal': makeMockElement(),
  'doctor-day-selector-container': makeMockElement()
};

globalThis.window = {
  localStorage: {
    getItem: key => storageMap.get(key) ?? null,
    setItem: (key, value) => storageMap.set(key, String(value)),
    removeItem: key => storageMap.delete(key),
    clear: () => storageMap.clear()
  },
  location: { hostname: 'localhost', search: '' },
  addEventListener: () => {}
};

globalThis.document = {
  addEventListener: () => {},
  getElementById: (id) => elements[id] || null,
  querySelector: () => null,
  querySelectorAll: () => [],
  createElement: () => makeMockElement(),
  body: makeMockElement()
};

// Import modules
const { MedicalService } = await import('../assets/js/services/medical-service.js');
const { openDoctorModal } = await import('../assets/js/admin/doctors.js');

// Test 1: openDoctorModal(null) - Adding new physician
await openDoctorModal(null);

assert.equal(elements['doctor-modal-title'].textContent, 'Add New Physician to Roster');
assert.equal(elements['doc-id'].value, '');
assert.equal(elements['doc-title'].value, 'Medical Officer');
assert.ok(elements['doc-service'].innerHTML.includes('<option'), 'Services dropdown must be populated with options');
assert.ok(!elements['doc-service'].innerHTML.includes('undefined'), 'Dropdown markup must not contain undefined');

// Test 2: openDoctorModal(doc) - Editing physician schedule
const sampleDoc = {
  id: 'doc-123',
  name: 'Dr. Adeyemi',
  title: 'Chief Consultant',
  serviceId: 'srv_general_outpatient',
  startTime: '09:00',
  endTime: '15:00',
  dailyCapacity: 30,
  room: 'Room 5',
  workingDays: ['Monday', 'Wednesday']
};

await openDoctorModal(sampleDoc);

assert.ok(elements['doctor-modal-title'].textContent.includes('Dr. Adeyemi'));
assert.equal(elements['doc-id'].value, 'doc-123');
assert.equal(elements['doc-title'].value, 'Chief Consultant');
assert.equal(elements['doc-start-time'].value, '09:00');
assert.equal(elements['doc-capacity'].value, 30);
assert.ok(elements['doc-service'].innerHTML.includes('selected'), 'Doctor service option must be selected');

console.log('PASS: openDoctorModal dynamically populates services and handles new/edit physician without ReferenceError');
