import { attendanceAllowsDate, attendanceAllowsTime } from './doctor-status.js';
import { Storage } from '../core/storage.js';
import { APP_CONFIG } from '../core/config.js';
import { INITIAL_SERVICES, INITIAL_APPOINTMENTS } from '../data/mock-data.js';

export const localDate = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
export const minutes = time => {
  if (!time) return NaN;
  const clean = String(time).trim();
  const match = clean.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?$/i);
  if (!match) return NaN;
  let hour = Number(match[1]);
  const min = Number(match[2]);
  const meridiem = (match[4] || '').toUpperCase();
  if (meridiem === 'PM' && hour < 12) hour += 12;
  if (meridiem === 'AM' && hour === 12) hour = 0;
  return hour * 60 + min;
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
      const docStart = doctor.startTime || doctor.schedule?.startTime || doctor.rawStartTime || doctor.workingHours?.start || serviceStartTime;
      const docEnd = doctor.endTime || doctor.schedule?.endTime || doctor.rawEndTime || doctor.workingHours?.end || serviceEndTime;
      const sStartMin = Number.isFinite(minutes(serviceStartTime)) ? minutes(serviceStartTime) : 8 * 60;
      const sEndMin = Number.isFinite(minutes(serviceEndTime)) ? minutes(serviceEndTime) : 18 * 60;
      const dStartMin = Number.isFinite(minutes(docStart)) ? minutes(docStart) : sStartMin;
      const dEndMin = Number.isFinite(minutes(docEnd)) ? minutes(docEnd) : sEndMin;
      const start = Math.max(sStartMin, dStartMin);
      const end = Math.min(sEndMin, dEndMin);
      for (let time = start; time + 30 <= end; time += 30) {
        if (date === localDate() && time <= new Date().getHours() * 60 + new Date().getMinutes()) continue;
        if (!attendanceAllowsTime(doctor, date, time)) continue;
        if (booked.some(a => {
          const slotM = minutes(a.timeSlot || a.time || a.startTime);
          return Number.isFinite(slotM) && slotM === time;
        })) continue;
        if (!slots.has(time)) slots.set(time, { time: timeLabel(time), doctor });
      }
    }
  }

  // Fallback: If no specific doctor was requested and NO doctor records exist for this service, generate consultation slots across service operating hours
  const allServiceDoctors = (Array.isArray(storedDoctors) ? storedDoctors : []).filter(d =>
    d.serviceId === serviceId || d.serviceId === serviceCanonicalId ||
    d.service?.publicId === serviceId || d.service?.publicId === serviceCanonicalId
  );
  if (slots.size === 0 && !doctorId && allServiceDoctors.length === 0) {
    const sStartMin = Number.isFinite(minutes(serviceStartTime)) ? minutes(serviceStartTime) : 8 * 60;
    const sEndMin = Number.isFinite(minutes(serviceEndTime)) ? minutes(serviceEndTime) : 16 * 60;
    for (let time = sStartMin; time + 30 <= sEndMin; time += 30) {
      if (date === localDate() && time <= new Date().getHours() * 60 + new Date().getMinutes()) continue;
      if (bookedForService.some(a => {
        const slotM = minutes(a.timeSlot || a.time || a.startTime);
        return Number.isFinite(slotM) && slotM === time;
      })) continue;
      slots.set(time, { time: timeLabel(time), doctor: { name: 'On-duty Medical Officer' } });
    }
  }

  return [...slots.entries()].sort((a, b) => a[0] - b[0]).map(([, slot]) => slot);
}
