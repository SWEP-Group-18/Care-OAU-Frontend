import { Storage } from '../core/storage.js';
import { APP_CONFIG } from '../core/config.js';
import { INITIAL_DOCTORS, INITIAL_SERVICES, INITIAL_APPOINTMENTS } from '../data/mock-data.js';

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
  const service = Storage.get(APP_CONFIG.STORAGE_KEYS.SERVICES, INITIAL_SERVICES).find(s => s.id === serviceId);
  const day = new Date(`${date}T12:00:00`).toLocaleDateString('en-US', { weekday: 'long' });
  if (!service?.isActive || !service.operatingDays.includes(day)) return [];
  const appointments = Storage.get(APP_CONFIG.STORAGE_KEYS.APPOINTMENTS, []).filter(a =>
    a.id !== excludeId && (a.appointmentDate || a.date) === date && !['Cancelled', 'Rejected'].includes(a.status));
  if (appointments.filter(a => a.serviceId === serviceId).length >= service.dailyCapacity) return [];
  const doctors = Storage.get(APP_CONFIG.STORAGE_KEYS.DOCTORS, INITIAL_DOCTORS).filter(d =>
    d.serviceId === serviceId && (!doctorId || d.id === doctorId) && d.isAvailable && d.workingDays.includes(day));
  const slots = new Map();
  for (const doctor of doctors) {
    const booked = appointments.filter(a => a.doctorId === doctor.id);
    const initialIds = new Set(INITIAL_APPOINTMENTS.map(a => a.id));
    const load = date === localDate() ? (doctor.currentLoad || 0) + booked.filter(a => !initialIds.has(a.id)).length : booked.length;
    if (load >= doctor.dailyCapacity) continue;
    const start = Math.max(minutes(service.startTime), minutes(doctor.startTime));
    const end = Math.min(minutes(service.endTime), minutes(doctor.endTime));
    for (let time = start; time + 30 <= end; time += 30) {
      if (date === localDate() && time <= new Date().getHours() * 60 + new Date().getMinutes()) continue;
      if (booked.some(a => minutes(a.timeSlot || a.time) === time)) continue;
      if (!slots.has(time)) slots.set(time, { time: timeLabel(time), doctor });
    }
  }
  return [...slots.entries()].sort((a, b) => a[0] - b[0]).map(([, slot]) => slot);
}
