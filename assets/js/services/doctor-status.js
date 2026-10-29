import { Storage } from '../core/storage.js';
import { APP_CONFIG } from '../core/config.js';
import { INITIAL_APPOINTMENTS } from '../data/mock-data.js';

export const DOCTOR_STATUSES = ['Available', 'In Consultation', 'On Break', 'Arriving Soon', 'Off Duty', 'On Leave'];
export const statusTone = status => ({ Available: 'success', 'In Consultation': 'info', 'On Break': 'warning', 'Arriving Soon': 'info', 'Off Duty': 'neutral', 'On Leave': 'neutral' })[status] || 'neutral';
export const dateKey = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
export function attendanceStatus(doctor, date = dateKey()) {
  if (!doctor) return 'Available';
  if (!DOCTOR_STATUSES.includes(doctor.status)) return doctor.isAvailable === false ? 'On Leave' : 'Available';
  // Attendance is for a particular day, not a permanent change to the duty roster.
  if (date !== (doctor.statusDate || dateKey())) return 'Available';
  return doctor.status;
}
export function attendanceAllowsDate(doctor, date) {
  return !['Off Duty', 'On Leave'].includes(attendanceStatus(doctor, date));
}
export function attendanceAllowsTime(doctor, date, slotMinutes) {
  if (!attendanceAllowsDate(doctor, date)) return false;
  if (date !== dateKey()) return true;
  const status = attendanceStatus(doctor);
  if (status === 'Arriving Soon') {
    const arrival = new Date(doctor.expectedArrivalAt);
    // An overdue estimate does not automatically mark the doctor present.
    if (!Number.isFinite(arrival.getTime()) || arrival <= new Date()) return false;
    return new Date(`${date}T00:00:00`).getTime() + slotMinutes * 60000 >= arrival.getTime();
  }
  if (['On Break', 'In Consultation'].includes(status)) {
    const now = new Date();
    return slotMinutes >= now.getHours() * 60 + now.getMinutes() + 30;
  }
  return true;
}
export function doctorLoad(doctor, date = dateKey()) {
  if (!doctor) return 0;
  const initialIds = new Set(INITIAL_APPOINTMENTS.map(a => a.id));
  const docId = doctor.publicId || doctor.id;
  const booked = Storage.get(APP_CONFIG.STORAGE_KEYS.APPOINTMENTS, []).filter(a => (a.doctorId === docId || a.doctorId === doctor.id) && (a.appointmentDate || a.date) === date && !['Cancelled', 'Rejected'].includes(a.status));
  return date === dateKey() ? (doctor.currentLoad || 0) + booked.filter(a => !initialIds.has(a.id)).length : booked.length;
}
export function saveDoctorStatus(id, status, arrivalMinutes) {
  if (Storage.get(APP_CONFIG.STORAGE_KEYS.AUTH_USER)?.role !== 'admin') throw new Error('Please sign in as staff to update attendance.');
  if (!DOCTOR_STATUSES.includes(status)) throw new Error('Choose a valid status.');
  if (status === 'Arriving Soon' && ![15, 30, 45, 60].includes(Number(arrivalMinutes))) throw new Error('Choose an expected arrival time.');
  const doctors = Storage.get(APP_CONFIG.STORAGE_KEYS.DOCTORS, []);
  if (!doctors.some(d => d.id === id || d.publicId === id)) throw new Error('Doctor not found.');
  const updated = doctors.map(d => (d.id === id || d.publicId === id) ? { ...d, status, statusDate: dateKey(), expectedArrivalAt: status === 'Arriving Soon' ? new Date(Date.now() + Number(arrivalMinutes) * 60000).toISOString() : null } : d);
  if (!Storage.set(APP_CONFIG.STORAGE_KEYS.DOCTORS, updated)) throw new Error('Unable to save attendance. Please try again.');
}
