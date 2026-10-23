import assert from 'node:assert/strict';

const memory = new Map();
globalThis.window = { localStorage: {
  getItem: key => memory.get(key) ?? null,
  setItem: (key, value) => memory.set(key, value),
  removeItem: key => memory.delete(key)
} };
const { Storage } = await import('../assets/js/core/storage.js');
const { APP_CONFIG: { STORAGE_KEYS: keys } } = await import('../assets/js/core/config.js');
const { availableSlots, localDate } = await import('../assets/js/services/availability.js');
const { AppointmentService: appointments } = await import('../assets/js/services/appointment-service.js');
const { QueueService: queue } = await import('../assets/js/services/queue-service.js');

const date = new Date(); date.setDate(date.getDate() + 1);
const day = date.toLocaleDateString('en-US', { weekday: 'long' });
const service = { id: 'service', name: 'Consultation', isActive: true, operatingDays: [day], startTime: '09:00', endTime: '12:00', dailyCapacity: 10 };
const doctor = { id: 'doctor', name: 'Doctor', serviceId: service.id, isAvailable: true, workingDays: [day], startTime: '10:00', endTime: '11:00', dailyCapacity: 1, room: 'Room 4' };
Storage.set(keys.SERVICES, [service]); Storage.set(keys.DOCTORS, [doctor]); Storage.set(keys.APPOINTMENTS, []); Storage.set(keys.QUEUE, []);
assert.deepEqual(availableSlots('service', 'doctor', localDate(date)).map(s => s.time), ['10:00 AM', '10:30 AM']);
Storage.set(keys.SERVICES, [{ ...service, isActive: false }]);
assert.equal(availableSlots('service', 'doctor', localDate(date)).length, 0, 'closed service must not be bookable');
Storage.set(keys.SERVICES, [service]);
Storage.set(keys.DOCTORS, [{ ...doctor, workingDays: [] }]);
assert.equal(availableSlots('service', 'doctor', localDate(date)).length, 0, 'off-duty doctor must not be bookable');
Storage.set(keys.DOCTORS, [doctor]);
const payload = { studentId: 'student-a', studentName: 'A', matricNo: 'TEST/001', serviceId: 'service', serviceName: 'Consultation', doctorId: 'doctor', appointmentDate: localDate(date), timeSlot: '10:00 AM' };
const created = await appointments.createAppointment(payload);
assert.ok(created.success); assert.equal(created.appointment.queueNumber, null); assert.equal(created.appointment.status, 'Pending Approval');
assert.equal((await appointments.createAppointment({ ...payload, timeSlot: '10:30 AM' })).success, false, 'daily capacity must be enforced');
assert.equal((await appointments.getStudentAppointments('student-b')).length, 0, 'student records must be scoped');
await appointments.cancelAppointment(created.appointment.id);
assert.equal(availableSlots('service', 'doctor', localDate(date)).length, 2, 'cancellation must release the reservation');
const second = await appointments.createAppointment(payload);
assert.equal((await appointments.checkInPatient(second.appointment.id)).success, false, 'approval required');
await appointments.approveAppointment(second.appointment.id);
assert.equal((await appointments.checkInPatient(second.appointment.id)).success, false, 'future visit cannot check in');
const records = await appointments.getAllAppointments();
records.find(a => a.id === second.appointment.id).appointmentDate = localDate();
Storage.set(keys.APPOINTMENTS, records);
const checked = await appointments.checkInPatient(second.appointment.id);
assert.ok(checked.success); assert.equal(checked.queueItem.room, 'Room 4');
assert.equal((await appointments.checkInPatient(second.appointment.id)).success, false, 'duplicate check-in rejected');
await queue.callNextPatient(); await queue.startConsultation(checked.queueItem.id);
assert.equal((await appointments.getAllAppointments()).find(a => a.id === second.appointment.id).status, 'In Consultation');
await queue.completeVisit(checked.queueItem.id);
assert.equal((await appointments.getAllAppointments()).find(a => a.id === second.appointment.id).status, 'Completed');
assert.equal(await queue.getStudentActiveTicket('TEST/001'), null);
console.log('PASS: schedule, closure, duty days, capacity, cancellation, student isolation, approval, date, duplicate check-in and queue lifecycle');
