import { attendanceAllowsDate, attendanceAllowsTime } from './doctor-status.js';
import { Storage } from '../core/storage.js';
import { APP_CONFIG } from '../core/config.js';
import { INITIAL_SERVICES, INITIAL_APPOINTMENTS } from '../data/mock-data.js';

export const localDate = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const minutes = time => {
  const match = String(time).match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (!match) return NaN;
  let hour = Number(match[1]);
  if (match[3]) hour = hour % 12 + (match[3].toUpperCase() === 'PM' ? 12 : 0);
  return hour * 60 + Number(match[2]);
};
const timeLabel = value => `${Math.floor(value / 60) % 12 || 12}:${String(value % 60).padStart(2, '0')} ${value >= 720 ? 'PM' : 'AM'}`;
export function availableSlots(serviceId, doctorId, date, excludeId = null) {
  if (!date || date < localDate()) return [];
  const storedServices = Storage.get(APP_CONFIG.STORAGE_KEYS.SERVICES, APP_CONFIG.USE_MOCK_DATA ? INITIAL_SERVICES : []);
  const services = Array.isArray(storedServices) ? storedServices : [];
  const service = services.find(s => s.publicId === serviceId || s.id === serviceId);
  if (!service) return [];

  const day = new Date(`${date}T12:00:00`).toLocaleDateString('en-US', { weekday: 'long' });
  const dayLower = day.toLowerCase();

  const isOpen = service.status === 'open' || service.isActive === true;
  const operatesOnDay = !Array.isArray(service.operatingDays) || service.operatingDays.length === 0 ||
    service.operatingDays.some(d => String(d).trim().toLowerCase() === dayLower) ||
    dayLower === 'saturday' || dayLower === 'sunday';

  if (!isOpen || !operatesOnDay) return [];

  const serviceCanonicalId = service.publicId || service.id;
  const appointments = Storage.get(APP_CONFIG.STORAGE_KEYS.APPOINTMENTS, []).filter(a =>
    a.id !== excludeId && (a.appointmentDate || a.date) === date && !['Cancelled', 'Rejected'].includes(a.status));

  const bookedForService = appointments.filter(a => a.serviceId === serviceId || a.serviceId === serviceCanonicalId);
  const capacity = Number(service.dailyCapacity ?? service.capacityPerDay ?? 50);
  if (bookedForService.length >= capacity) return [];

  const storedDoctors = Storage.get(APP_CONFIG.STORAGE_KEYS.DOCTORS, []);
  const doctors = (Array.isArray(storedDoctors) ? storedDoctors : []).filter(d => {
    const srvMatch = !serviceId || d.serviceId === serviceId || d.serviceId === serviceCanonicalId ||
      d.service?.publicId === serviceId || d.service?.publicId === serviceCanonicalId;
    const docMatch = !doctorId || d.id === doctorId || d.publicId === doctorId;
    if (!srvMatch || !docMatch) return false;
    if (!attendanceAllowsDate(d, date)) return false;
    const days = Array.isArray(d.workingDays)
      ? d.workingDays
      : ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    return days.some(w => String(w).trim().toLowerCase() === dayLower);
  });

  const serviceStartTime = service.startTime || (service.opensAt ? service.opensAt.slice(0, 5) : '08:00');
  const serviceEndTime = service.endTime || (service.closesAt ? service.closesAt.slice(0, 5) : '18:00');

  const slots = new Map();

  // If specific doctor records are found, build per-doctor availability
  if (doctors.length > 0) {
    for (const doctor of doctors) {
      const booked = appointments.filter(a => a.doctorId === doctor.id || a.doctorId === doctor.publicId);
      const initialIds = new Set(INITIAL_APPOINTMENTS.map(a => a.id));
      const load = date === localDate() ? (doctor.currentLoad || 0) + booked.filter(a => !initialIds.has(a.id)).length : booked.length;
      if (load >= (doctor.dailyCapacity || 25)) continue;
      const docStart = doctor.startTime || doctor.workingHours?.start?.slice(0, 5) || serviceStartTime;
      const docEnd = doctor.endTime || doctor.workingHours?.end?.slice(0, 5) || serviceEndTime;
      const start = Math.max(minutes(serviceStartTime), minutes(docStart));
      const end = Math.min(minutes(serviceEndTime), minutes(docEnd));
      for (let time = start; time + 30 <= end; time += 30) {
        if (date === localDate() && time <= new Date().getHours() * 60 + new Date().getMinutes()) continue;
        if (!attendanceAllowsTime(doctor, date, time)) continue;
        if (booked.some(a => minutes(a.timeSlot || a.time) === time)) continue;
        if (!slots.has(time)) slots.set(time, { time: timeLabel(time), doctor });
      }
    }
  }

  // Fallback: If no specific doctor was requested and no doctor matched on this day/weekend, generate consultation slots across service operating hours
  if (slots.size === 0 && !doctorId) {
    const start = minutes(serviceStartTime || '08:00');
    const end = minutes(serviceEndTime || '16:00');
    for (let time = start; time + 30 <= end; time += 30) {
      if (date === localDate() && time <= new Date().getHours() * 60 + new Date().getMinutes()) continue;
      if (bookedForService.some(a => minutes(a.timeSlot || a.time) === time)) continue;
      slots.set(time, { time: timeLabel(time), doctor: { name: 'On-duty Medical Officer' } });
    }
  }

  return [...slots.entries()].sort((a, b) => a[0] - b[0]).map(([, slot]) => slot);
}
