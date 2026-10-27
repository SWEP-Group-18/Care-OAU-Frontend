import { attendanceStatus, attendanceAllowsDate } from '../services/doctor-status.js';
import { Utils } from '../core/utils.js';
import { availableSlots, localDate } from '../services/availability.js';
import { Navigation } from '../core/navigation.js';
import { Storage } from '../core/storage.js';
import { APP_CONFIG } from '../core/config.js';
import { StudentSidebar } from '../components/student-sidebar.js';
import { Header } from '../components/header.js';
import { DoctorService } from '../services/doctor-service.js';
import { INITIAL_SERVICES, INITIAL_APPOINTMENTS } from '../data/mock-data.js';

const keys = APP_CONFIG.STORAGE_KEYS;
const seededAppointmentIds = new Set(INITIAL_APPOINTMENTS.map(appointment => appointment.id));
let selectedDate = localDate();
let specialty = 'All';
const escape = value => Utils.escapeHtml(String(value ?? ''));
const specialtyOf = doctor => doctor.specialization || doctor.specialty || 'General Medicine';
const dayOf = date => new Date(`${date}T12:00:00`).toLocaleDateString('en-US', { weekday: 'long' });
const formatDate = date => new Date(`${date}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
const formatTime = time => {
  if (!/^\d{2}:\d{2}$/.test(time || '')) return time || 'Not scheduled';
  const [hour, minute] = time.split(':').map(Number);
  return `${hour % 12 || 12}:${String(minute).padStart(2, '0')} ${hour >= 12 ? 'PM' : 'AM'}`;
};

// Match the shared booking service's reservation and daily-capacity rules.
function remainingCapacity(doctor, service, date) {
  const reservations = Storage.get(keys.APPOINTMENTS, []).filter(appointment =>
    (appointment.appointmentDate || appointment.date) === date && !['Cancelled', 'Rejected'].includes(appointment.status));
  const booked = reservations.filter(appointment => appointment.doctorId === doctor.id);
  const load = date === localDate()
    ? (doctor.currentLoad || 0) + booked.filter(appointment => !seededAppointmentIds.has(appointment.id)).length
    : booked.length;
  const serviceLoad = reservations.filter(appointment => appointment.serviceId === doctor.serviceId).length;
  return Math.max(0, Math.min(doctor.dailyCapacity - load, service.dailyCapacity - serviceLoad));
}

function nextOpening(doctor, date) {
  const day = new Date(`${date}T12:00:00`);
  // Weekly schedules repeat; look ahead four weeks, allowing for existing bookings.
  for (let offset = 1; offset <= 28; offset++) {
    day.setDate(day.getDate() + 1);
    const nextDate = localDate(day);
    const slot = availableSlots(doctor.serviceId, doctor.id, nextDate)[0];
    if (slot) return { date: nextDate, time: slot.time };
  }
  return null;
}

function doctorState(doctor, services) {
  const service = services.find(item => item.id === doctor.serviceId);
  const today = selectedDate === localDate();
  const now = new Date();
  const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const onDuty = Boolean(attendanceAllowsDate(doctor, selectedDate) && doctor.workingDays?.includes(dayOf(selectedDate)));
  const serviceOpen = Boolean(service?.isActive && service.operatingDays?.includes(dayOf(selectedDate)));
  const slots = availableSlots(doctor.serviceId, doctor.id, selectedDate);
  const capacity = service ? remainingCapacity(doctor, service, selectedDate) : 0;
  const remaining = Math.min(capacity, slots.length);
  const shiftEnded = today && currentTime >= doctor.endTime;
  const attendance = attendanceStatus(doctor, selectedDate);
  let status = attendance;
  let tone = ({ 'Available': 'available', 'On Break': 'break', 'In Consultation': 'consultation', 'Arriving Soon': 'consultation', 'Off Duty': 'off-duty', 'On Leave': 'off-duty' })[attendance];
  if (!serviceOpen || shiftEnded || !doctor.workingDays?.includes(dayOf(selectedDate))) { status = 'Off Duty'; tone = 'off-duty'; }
  if (capacity === 0 && onDuty && serviceOpen) { status = 'Fully Booked'; tone = 'full'; }
  const next = remaining ? { date: selectedDate, time: slots[0].time } : nextOpening(doctor, selectedDate);
  return { status, tone, remaining, next, onDuty, serviceOpen };
}

function renderCard(doctor, services) {
  const state = doctorState(doctor, services);
  const initials = (doctor.name || 'Doctor').replace(/^Dr\.?\s*(\(Mrs\)\s*)?/i, '').split(/\s+/).filter(Boolean).map(part => part[0]).slice(0, 2).join('').toUpperCase();
  const href = date => `book-appointment.html?${new URLSearchParams({ doctorId: doctor.id, date })}`;
  const nextLabel = state.next
    ? `${state.next.date === selectedDate ? '' : formatDate(state.next.date) + ' · '}${state.next.time}`
    : 'No opening in the next 4 weeks';
  return `<article class="availability-card" data-doctor-id="${escape(doctor.id)}">
    <div class="availability-card-top">
      <span class="availability-avatar" aria-hidden="true">${escape(initials)}</span>
      <span class="availability-badge availability-badge--${state.tone}"><span aria-hidden="true"></span>${state.status}</span>
    </div>
    <div class="availability-identity"><h2>${escape(doctor.name)}</h2><p>${escape(specialtyOf(doctor))}</p></div>
    <dl class="availability-details">
      <div><dt>Working hours</dt><dd>${escape(formatTime(doctor.startTime))} – ${escape(formatTime(doctor.endTime))}</dd></div>
      <div><dt>Appointment slots</dt><dd class="availability-slots ${state.remaining ? '' : 'availability-slots--empty'}">${state.remaining} ${state.remaining === 1 ? 'slot' : 'slots'} left</dd></div>
      ${attendanceStatus(doctor, selectedDate) === 'Arriving Soon' && doctor.expectedArrivalAt ? '<div><dt>Expected arrival</dt><dd>' + escape(new Date(doctor.expectedArrivalAt).toLocaleTimeString('en-GB', {hour:'2-digit',minute:'2-digit'})) + '</dd></div>' : ''}
      <div><dt>Next available</dt><dd>${escape(nextLabel)}</dd></div>
    </dl>
    <div class="availability-actions">
      ${state.remaining
        ? `<a class="button button-primary" href="${escape(href(selectedDate))}" aria-label="Book appointment with ${escape(doctor.name)}">Book Appointment <span aria-hidden="true">↗</span></a>`
        : `<button class="button button-secondary" disabled>${state.status === 'Fully Booked' ? 'Fully booked for this date' : 'Unavailable for this date'}</button>${state.next ? `<a class="availability-next" href="${escape(href(state.next.date))}" aria-label="View next availability for ${escape(doctor.name)}">View next availability <span aria-hidden="true">→</span></a>` : '<span class="availability-next-note">Please check back for schedule updates.</span>'}`}
    </div>
  </article>`;
}

let currentAvailabilityState = {
  status: 'loading',
  doctors: [],
  statusCode: null
};

function refreshSpecialties(doctorsList = []) {
  const select = document.getElementById('filter-specialty');
  if (!select) return;
  const values = [...new Set(doctorsList.map(specialtyOf))].sort();
  if (!values.includes(specialty)) specialty = 'All';
  select.replaceChildren(new Option('All specialties', 'All'), ...values.map(value => new Option(value, value)));
  select.value = specialty;
}

function renderDoctors() {
  const listEl = document.getElementById('doctor-list');
  const countEl = document.getElementById('doctors-on-duty-count');
  const summaryEl = document.getElementById('doctor-results-summary');
  const updatedEl = document.getElementById('filter-updated-text');
  if (!listEl || !countEl || !summaryEl || !updatedEl) return;

  updatedEl.textContent = `For ${formatDate(selectedDate)} · Updated ${new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;

  // Loading state
  if (currentAvailabilityState.status === 'loading') {
    countEl.textContent = 'Checking duty schedules';
    summaryEl.textContent = 'Loading doctor records...';
    listEl.innerHTML = `
      <div class="availability-loading" role="status" aria-live="polite">
        <div class="spinner" aria-hidden="true"></div>
        <p>Checking doctor availability...</p>
      </div>`;
    return;
  }

  const allDoctors = currentAvailabilityState.doctors || [];

  // When no doctors exist (either empty confirmed, unavailable/not seeded yet, or 0 doctors)
  if (currentAvailabilityState.status === 'unavailable' || currentAvailabilityState.status === 'empty' || allDoctors.length === 0) {
    countEl.textContent = '0 doctors on duty';
    const badge = countEl.closest('.badge');
    if (badge) badge.className = 'badge badge-neutral';
    summaryEl.textContent = '0 doctors available';
    listEl.innerHTML = `
      <div class="availability-empty">
        <div class="empty-icon" aria-hidden="true">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
            <circle cx="12" cy="7" r="4"></circle>
          </svg>
        </div>
        <h2>No doctors available yet</h2>
        <p>Doctor profiles and availability will appear here once the health centre team adds and publishes them. Please check back later.</p>
      </div>`;
    return;
  }

  // Filtered by specialty
  const filtered = allDoctors.filter(doctor => specialty === 'All' || specialtyOf(doctor) === specialty);
  const services = Storage.get(keys.SERVICES, APP_CONFIG.USE_MOCK_DATA ? INITIAL_SERVICES : []);

  // Filter empty state: records exist, but none match the filter
  if (filtered.length === 0) {
    countEl.textContent = '0 doctors on duty';
    const badge = countEl.closest('.badge');
    if (badge) badge.className = 'badge badge-neutral';
    summaryEl.textContent = `0 doctors in ${specialty}`;
    listEl.innerHTML = `
      <div class="availability-empty">
        <div class="empty-icon" aria-hidden="true">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
        </div>
        <h2>No doctors found</h2>
        <p>Try another specialty or check back for updated schedules.</p>
      </div>`;
    return;
  }

  // Normal populated state
  const count = filtered.filter(doctor => doctorState(doctor, services).onDuty).length;
  countEl.textContent = `${count} ${count === 1 ? 'doctor' : 'doctors'} on duty`;
  const badge = countEl.closest('.badge');
  if (badge) badge.className = count > 0 ? 'badge badge-success' : 'badge badge-neutral';
  summaryEl.textContent = `${filtered.length} ${filtered.length === 1 ? 'doctor' : 'doctors'}${specialty === 'All' ? ' across all specialties' : ' in ' + specialty}`;
  listEl.innerHTML = filtered.map(doctor => renderCard(doctor, services)).join('');
}

async function fetchAndDisplayDoctors() {
  DoctorService.purgeLegacyDemoDoctors();
  currentAvailabilityState = { status: 'loading', doctors: [] };
  renderDoctors();

  const availability = await DoctorService.getDoctorAvailability();
  currentAvailabilityState = availability;
  refreshSpecialties(availability.doctors || []);
  renderDoctors();
}

document.addEventListener('DOMContentLoaded', () => {
  if (!Navigation.requireAuth('student')) return;
  Header.render('Doctor Availability');
  StudentSidebar.render();
  const dateInput = document.getElementById('filter-date');
  dateInput.min = selectedDate;
  dateInput.value = selectedDate;
  dateInput.addEventListener('change', () => {
    if (!dateInput.value || !dateInput.checkValidity()) {
      dateInput.value = selectedDate;
      return;
    }
    selectedDate = dateInput.value;
    renderDoctors();
  });
  document.getElementById('filter-specialty').addEventListener('change', event => {
    specialty = event.target.value;
    renderDoctors();
  });
  window.addEventListener('storage', event => {
    if ([keys.DOCTORS, keys.SERVICES, keys.APPOINTMENTS].includes(event.key) || event.key === null) {
      fetchAndDisplayDoctors();
    }
  });

  const gridBtn = document.getElementById('view-grid');
  const listBtn = document.getElementById('view-list');
  const grid = document.getElementById('doctor-list');
  if (gridBtn && listBtn && grid) {
    gridBtn.addEventListener('click', () => {
      grid.classList.remove('list-view');
      gridBtn.setAttribute('aria-pressed', 'true');
      listBtn.setAttribute('aria-pressed', 'false');
    });
    listBtn.addEventListener('click', () => {
      grid.classList.add('list-view');
      listBtn.setAttribute('aria-pressed', 'true');
      gridBtn.setAttribute('aria-pressed', 'false');
    });
  }

  fetchAndDisplayDoctors();
});
