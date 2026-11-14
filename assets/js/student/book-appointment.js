import { Utils } from '../core/utils.js';
import { availableSlots, localDate, minutes } from '../services/availability.js';
import { AppointmentService } from '../services/appointment-service.js';
import { Navigation } from '../core/navigation.js';
/**
 * Care-OAU - Book Appointment Wizard Logic (Figma Reference Aligned)
 * Handles 4-step selection, earliest available doctor option, schedule-based slot calculation,
 * referral validation, capacity checks, and pending approval confirmation ticket generation.
 */

import { Storage } from '../core/storage.js';
import { APP_CONFIG } from '../core/config.js';
import { StudentSidebar } from '../components/student-sidebar.js';
import { Header } from '../components/header.js';
import { Toast } from '../components/toast.js';
import { DoctorService, fromBackendDoctor } from '../services/doctor-service.js';
import { MedicalService, fromBackendService } from '../services/medical-service.js';
import { INITIAL_SERVICES, INITIAL_APPOINTMENTS } from '../data/mock-data.js';

let currentStep = 1;
let selectedServiceObj = null;
let selectedDoctorObj = null; // null represents "Earliest available doctor"
let isEarliestDoctor = true;
let selectedDateStr = '';
let selectedTimeStr = '';
let referralCode = '';
let skippedStep3 = false;
let earliestMatchedDoctor = null;

async function initBookingWizard() {
  if (!Navigation.requireAuth('student')) return;
  DoctorService.purgeLegacyDemoDoctors();
  Header.render('Book an Appointment');
  StudentSidebar.render();

  // Seed data only in isolated mock/test mode
  if (APP_CONFIG.USE_MOCK_DATA) {
    if (!Storage.get(APP_CONFIG.STORAGE_KEYS.SERVICES)) {
      Storage.set(APP_CONFIG.STORAGE_KEYS.SERVICES, INITIAL_SERVICES);
    }
    if (!Storage.get(APP_CONFIG.STORAGE_KEYS.APPOINTMENTS)) {
      Storage.set(APP_CONFIG.STORAGE_KEYS.APPOINTMENTS, INITIAL_APPOINTMENTS);
    }
  }

  // Pre-select doctor if passed in query param
  const urlParams = new URLSearchParams(window.location.search);
  const paramDoctorId = urlParams.get('doctorId');

  initDates();
  await initServices(paramDoctorId);
  bindNavigationEvents();
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initBookingWizard);
  } else {
    initBookingWizard();
  }
}

function initDates(targetDateStr = null) {
  const dates = [];
  const today = new Date();

  let target = targetDateStr;
  if (!target) {
    const requestedDate = new URLSearchParams(location.search).get('date');
    if (requestedDate && /^\d{4}-\d{2}-\d{2}$/.test(requestedDate) && requestedDate >= localDate()) {
      target = requestedDate;
    } else {
      target = localDate();
    }
  }

  // Ensure target date falls within the visible 7-day strip window
  let startDate = new Date(today);
  if (target > localDate()) {
    const targetDt = new Date(`${target}T12:00:00`);
    const diffDays = Math.floor((targetDt - new Date(`${localDate()}T12:00:00`)) / 86400000);
    if (diffDays >= 7) {
      startDate = targetDt;
    }
  }

  let d = new Date(startDate);
  while (dates.length < 7) {
    dates.push(new Date(d));
    d.setDate(d.getDate() + 1);
  }

  selectedDateStr = target;
  renderDateStrip(dates);
}

function renderDateStrip(dates) {
  const container = document.getElementById('date-strip-container');
  if (!container) return;

  const dayNamesShort = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  container.innerHTML = `
    <button type="button" id="btn-date-prev" aria-label="Previous date">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="15 18 9 12 15 6"></polyline>
      </svg>
    </button>
    ${dates.map((dt) => {
    const iso = dt.toLocaleDateString('en-CA');
    const isSelected = iso === selectedDateStr;
    const dayShort = dayNamesShort[dt.getDay()];
    const dayNum = dt.getDate();
    return `
        <button type="button" class="${isSelected ? 'active' : ''}" data-date="${iso}">
          <span>${dayShort}</span>
          <strong>${dayNum}</strong>
        </button>
      `;
  }).join('')}
    <button type="button" id="btn-date-next" aria-label="Next date">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="9 18 15 12 9 6"></polyline>
      </svg>
    </button>
  `;

  container.querySelectorAll('button[data-date]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      container.querySelectorAll('button[data-date]').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      selectedDateStr = btn.dataset.date;
      updateDateSlotLabel();
      await renderTimeSlots();
      updateSummary();
    });
  });

  for (const [id, direction] of [['btn-date-prev', -1], ['btn-date-next', 1]]) {
    const button = document.getElementById(id);
    if (!button) continue;
    button.disabled = direction === -1 && localDate(dates[0]) <= localDate();
    button.onclick = async () => {
      const next = dates.map(date => { const value = new Date(date); value.setDate(value.getDate() + direction * 7); return value; });
      if (localDate(next[0]) < localDate()) return;
      selectedDateStr = localDate(next[0]);
      renderDateStrip(next);
      updateDateSlotLabel();
      await renderTimeSlots();
      updateSummary();
    };
  }
  updateDateSlotLabel();
  renderTimeSlots();
}

function updateDateSlotLabel() {
  const label = document.getElementById('selected-date-slot-label');
  if (!label || !selectedDateStr) return;
  const d = new Date(selectedDateStr + 'T12:00:00');
  label.textContent = d.toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'short' });
}

async function renderTimeSlots() {
  const container = document.getElementById('time-grid-container');
  if (!container) return;

  const srvId = selectedServiceObj?.publicId || selectedServiceObj?.id;
  const docId = isEarliestDoctor ? null : (selectedDoctorObj?.publicId || selectedDoctorObj?.id);

  container.innerHTML = `
    <div style="grid-column: 1 / -1; padding: 18px; text-align: center;">
      <p class="text-secondary" style="font-size: var(--font-size-sm);">Checking available times...</p>
    </div>
  `;

  let slots = [];
  try {
    slots = await AppointmentService.getAvailableSlots({
      servicePublicId: srvId,
      date: selectedDateStr,
      doctorPublicId: docId
    });
  } catch (err) {
    console.warn('[BookAppointment] Error fetching slots:', err);
    slots = availableSlots(srvId, docId, selectedDateStr);
  }

  // Doctor allocated hours restriction:
  // If a specific doctor is selected, strictly filter slots to that doctor's working schedule (e.g. 10am - 2pm)
  if (selectedDoctorObj && !isEarliestDoctor) {
    const docStart = selectedDoctorObj.startTime || selectedDoctorObj.schedule?.startTime || selectedDoctorObj.rawStartTime;
    const docEnd = selectedDoctorObj.endTime || selectedDoctorObj.schedule?.endTime || selectedDoctorObj.rawEndTime;
    const docStartMin = minutes(docStart);
    const docEndMin = minutes(docEnd);

    if (Number.isFinite(docStartMin) && Number.isFinite(docEndMin) && docEndMin > docStartMin) {
      slots = (slots || []).filter(s => {
        const slotMin = minutes(s.startTime || s.time);
        return Number.isFinite(slotMin) && slotMin >= docStartMin && (slotMin + 30) <= docEndMin;
      });
    }

    if (!Array.isArray(slots) || slots.length === 0) {
      const docName = selectedDoctorObj.name || 'this physician';
      container.innerHTML = `
        <p class="capacity-guidance" style="grid-column: 1 / -1; padding: var(--space-4); text-align: center;">
          No available times for ${Utils.escapeHtml(docName)} on this date.
          Please choose another date or select <strong>Earliest available doctor</strong>.
        </p>
      `;
      selectedTimeStr = '';
      updateSummary();
      return;
    }
  }

  // If Earliest doctor is selected and slots is empty, calculate local availableSlots fallback
  if (isEarliestDoctor && (!Array.isArray(slots) || slots.length === 0)) {
    slots = availableSlots(srvId, null, selectedDateStr);
  }

  if (!Array.isArray(slots) || slots.length === 0) {
    container.innerHTML = '<p class="capacity-guidance" style="grid-column: 1 / -1; padding: var(--space-4); text-align: center;">No available times on this date. Choose another date or doctor.</p>';
    selectedTimeStr = '';
    updateSummary();
    return;
  }

  // Automatically select the first available slot that is not fully booked
  const availableSlotsList = slots.filter(s => !s.full && s.status !== 'fully_booked');
  if (!availableSlotsList.some(s => s.time === selectedTimeStr)) {
    selectedTimeStr = availableSlotsList[0] ? availableSlotsList[0].time : (slots[0]?.time || '');
  }

  container.innerHTML = slots.map((s) => {
    const isFull = s.full || s.status === 'fully_booked';
    const isSelected = selectedTimeStr === s.time;
    return `
      <button type="button" class="${isSelected ? 'selected' : ''}" ${isFull ? 'disabled' : ''} data-time="${s.time}">
        ${s.time}
        ${isFull ? '<small>Booked</small>' : ''}
      </button>
    `;
  }).join('');

  container.querySelectorAll('button:not(:disabled)').forEach((btn) => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('button').forEach((b) => b.classList.remove('selected'));
      btn.classList.add('selected');
      selectedTimeStr = btn.dataset.time;
      updateSummary();
    });
  });

  updateSummary();
}

async function initServices(paramDoctorId) {
  const container = document.getElementById('service-options-container');
  if (!container) return;

  container.innerHTML = `
    <div style="padding: var(--space-8); text-align: center;">
      <p class="text-secondary" style="font-size: var(--font-size-sm);">Loading available clinical services...</p>
    </div>
  `;

  let services = [];
  try {
    services = await MedicalService.getAvailableServices();
  } catch (err) {
    console.warn('[BookAppointment] Failed to load services via MedicalService:', err);
    services = Storage.get(APP_CONFIG.STORAGE_KEYS.SERVICES, []);
  }

  // Gracefully fallback to initial clinic services if neither API nor local cache has records
  if (!Array.isArray(services) || services.length === 0) {
    services = INITIAL_SERVICES.map(fromBackendService);
    Storage.set(APP_CONFIG.STORAGE_KEYS.SERVICES, services);
  }

  const openServices = (Array.isArray(services) ? services : []).filter(s => s.status === 'open' || s.isActive === true);

  if (openServices.length === 0) {
    selectedServiceObj = null;
    container.innerHTML = `
      <div style="padding: var(--space-8); text-align: center; border: 1px dashed var(--color-border); border-radius: var(--radius-lg); background: var(--color-surface);">
        <p style="font-weight: 500; margin-bottom: var(--space-2);">No clinical services are currently open for booking.</p>
        <p class="text-secondary" style="font-size: var(--font-size-xs);">Please check back during operating hours or contact the clinic reception.</p>
      </div>
    `;
    const referralWrap = document.getElementById('referral-field-container');
    if (referralWrap) referralWrap.style.display = 'none';
    updateSummary();
    return;
  }

  selectedServiceObj = openServices[0];
  if (paramDoctorId) {
    const doc = Storage.get(APP_CONFIG.STORAGE_KEYS.DOCTORS, []).find(d => d.id === paramDoctorId || d.publicId === paramDoctorId);
    const match = openServices.find(s => (s.publicId === doc?.serviceId || s.id === doc?.serviceId));
    if (match) selectedServiceObj = match;
  }

  container.innerHTML = openServices.map((srv) => {
    const srvId = srv.publicId || srv.id;
    const isSelected = selectedServiceObj && (selectedServiceObj.publicId === srvId || selectedServiceObj.id === srvId);
    return `
      <button type="button" class="choice-card ${isSelected ? 'selected' : ''}" data-service-id="${srvId}">
        <span class="choice-radio">
          ${isSelected ? '<span></span>' : ''}
        </span>
        <span class="choice-copy">
          <strong>${Utils.escapeHtml(srv.name)}</strong>
          <small>${srv.description || 'Consultation and clinical support'}</small>
          <span>${srv.requiresReferral ? 'Referral required' : 'No referral needed'}</span>
        </span>
      </button>
    `;
  }).join('');

  container.querySelectorAll('.choice-card').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const clickedId = btn.dataset.serviceId;
      selectedServiceObj = openServices.find((s) => s.publicId === clickedId || s.id === clickedId) || openServices[0];

      container.querySelectorAll('.choice-card').forEach((b) => {
        b.classList.remove('selected');
        const radio = b.querySelector('.choice-radio');
        if (radio) radio.innerHTML = '';
      });

      btn.classList.add('selected');
      const radio = btn.querySelector('.choice-radio');
      if (radio) radio.innerHTML = '<span></span>';

      // Toggle referral field if required
      const referralWrap = document.getElementById('referral-field-container');
      if (referralWrap) {
        referralWrap.style.display = selectedServiceObj?.requiresReferral ? 'flex' : 'none';
      }

      updateSummary();
      selectedDoctorObj = null;
      isEarliestDoctor = true;
      await initDoctors();
      renderTimeSlots();
    });
  });

  await initDoctors(paramDoctorId);
  const refWrap = document.getElementById('referral-field-container');
  if (refWrap) refWrap.style.display = selectedServiceObj?.requiresReferral ? 'flex' : 'none';
  renderTimeSlots();
  updateSummary();
}

export function doctorMatchesService(doc, service) {
  if (!doc || !service) return false;
  const srvId = String(service.publicId || service.id || '').trim();
  const srvName = String(service.name || '').toLowerCase().trim();
  const srvCat = String(service.category || '').toLowerCase().trim();

  // 1. Direct ID matches
  if (doc.serviceId && (doc.serviceId === srvId || doc.serviceId === service.id || doc.serviceId === service.publicId)) {
    return true;
  }
  if (doc.service?.publicId && (doc.service.publicId === srvId || doc.service.publicId === service.id)) {
    return true;
  }

  // 2. Name or specialization matches
  const docSpec = String(doc.specialization || '').toLowerCase().trim();
  const docSrvName = String(doc.serviceName || doc.service?.name || '').toLowerCase().trim();

  if (docSpec && (docSpec === srvName || srvName.includes(docSpec) || docSpec.includes(srvName))) {
    return true;
  }
  if (docSrvName && (docSrvName === srvName || srvName.includes(docSrvName) || docSrvName.includes(srvName))) {
    return true;
  }

  // 3. Category match
  if (srvCat && (docSpec.includes(srvCat) || srvCat.includes(docSpec))) {
    return true;
  }

  return false;
}

async function initDoctors(paramDoctorId) {
   const container = document.getElementById('doctor-choices-container');
  if (!container) return;

  container.innerHTML = `
    <div style="padding: var(--space-8); text-align: center;">
      <p class="text-secondary">Loading available doctors...</p>
    </div>
  `;

  let doctors = [];

  try {
    const rawDoctors = await MedicalService.getServiceDoctors(
      selectedServiceObj?.publicId || selectedServiceObj?.id
    );

    doctors = (Array.isArray(rawDoctors) ? rawDoctors : [])
      .map(fromBackendDoctor)
      .filter(Boolean);
  } catch (err) {
    console.error('[BookAppointment] Failed to load service doctors:', err);

    container.innerHTML = `
      <div class="capacity-guidance">
        Unable to load doctors right now. Please try again.
      </div>
    `;
    return;
  }

  // Pre-selection if paramDoctorId provided
  if (paramDoctorId) {
    const match = doctors.find((d) => (d.publicId === paramDoctorId || d.id === paramDoctorId));
    if (match) {
      selectedDoctorObj = match;
      isEarliestDoctor = false;
    }
  }

  const earliestCardHtml = `
    <button type="button" class="choice-card feature-choice ${isEarliestDoctor ? 'selected' : ''}" id="choice-earliest-doc">
      <span class="choice-radio">
        ${isEarliestDoctor ? '<span></span>' : ''}
      </span>
      <span class="choice-copy">
        <span class="choice-label">Recommended</span>
        <strong>Earliest available doctor</strong>
        <small>We'll assign the first available clinical officer on duty.</small>
      </span>
      <strong class="choice-time">
        Next<br>
        <span>available slot</span>
      </strong>
    </button>
  `;

  const doctorsHtml = doctors.map((doc) => {
    const docId = doc.publicId || doc.id;
    const isSelected = !isEarliestDoctor && selectedDoctorObj && (selectedDoctorObj.publicId === docId || selectedDoctorObj.id === docId);
    const capacity = doc.dailyCapacity || 25;
    const currentLoad = doc.currentLoad || 0;
    const isFull = false;
    const slotsRemaining = Math.max(0, capacity - currentLoad);

    const parts = (doc.name || 'Doctor').replace(/^Dr\.?\s+/i, '').split(' ');
    const initials = parts.map((p) => p[0]).slice(0, 2).join('').toUpperCase();

    return `
      <button type="button" class="choice-card ${isSelected ? 'selected' : ''}" data-doctor-id="${docId}" ${isFull ? 'disabled' : ''}>
        <span class="choice-radio">
          ${isSelected ? '<span></span>' : ''}
        </span>
        <span class="doctor-avatar small">${initials}</span>
        <span class="choice-copy">
          <strong>${Utils.escapeHtml(doc.name)}</strong>
          <small>${doc.specialization || doc.specialty || 'General Practitioner'}</small>
          <span>
            ${isFull ? 'Full for this shift · Next: tomorrow, 9:00 AM' : `${slotsRemaining} place${slotsRemaining === 1 ? '' : 's'} remaining`}
          </span>
        </span>
        ${isFull ? '<span class="badge badge-danger">Full</span>' : ''}
      </button>
    `;
  }).join('');

  const guidanceHtml = `
    <div class="capacity-guidance">
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="8" x2="12" y2="12"></line>
        <line x1="12" y1="16" x2="12.01" y2="16"></line>
      </svg>
      <span>When preferred physicians reach capacity, choose the earliest available doctor or select their next available date.</span>
    </div>
  `;

  container.innerHTML = earliestCardHtml + doctorsHtml + guidanceHtml;

  // Earliest option listener
  const earliestBtn = document.getElementById('choice-earliest-doc');
  if (earliestBtn) {
    earliestBtn.addEventListener('click', () => {
      isEarliestDoctor = true;
      selectedDoctorObj = null;
      earliestMatchedDoctor = null;
      skippedStep3 = false;
      refreshDoctorSelectionUI(container);
      renderTimeSlots();
      updateSummary();
    });
  }

  // Doctor buttons listeners
  container.querySelectorAll('button[data-doctor-id]:not(:disabled)').forEach((btn) => {
    btn.addEventListener('click', () => {
      const docId = btn.dataset.doctorId;
      selectedDoctorObj = doctors.find((d) => (d.publicId === docId || d.id === docId));
      isEarliestDoctor = false;
      earliestMatchedDoctor = null;
      skippedStep3 = false;
      refreshDoctorSelectionUI(container);
      renderTimeSlots();
      updateSummary();
    });
  });
}

function refreshDoctorSelectionUI(container) {
  container.querySelectorAll('.choice-card').forEach((b) => {
    b.classList.remove('selected');
    const radio = b.querySelector('.choice-radio');
    if (radio) radio.innerHTML = '';
  });

  if (isEarliestDoctor) {
    const earliestBtn = document.getElementById('choice-earliest-doc');
    if (earliestBtn) {
      earliestBtn.classList.add('selected');
      const radio = earliestBtn.querySelector('.choice-radio');
      if (radio) radio.innerHTML = '<span></span>';
    }
  } else if (selectedDoctorObj) {
    const docId = selectedDoctorObj.publicId || selectedDoctorObj.id;
    const selectedBtn = container.querySelector(`button[data-doctor-id="${docId}"]`);
    if (selectedBtn) {
      selectedBtn.classList.add('selected');
      const radio = selectedBtn.querySelector('.choice-radio');
      if (radio) radio.innerHTML = '<span></span>';
    }
  }
}

function updateSummary() {
  const srvEl = document.getElementById('summary-service');
  const docEl = document.getElementById('summary-doctor');
  const dateEl = document.getElementById('summary-date');
  const timeEl = document.getElementById('summary-time');

  const displayDocName = isEarliestDoctor
    ? (earliestMatchedDoctor?.name ? `${earliestMatchedDoctor.name} (Assigned)` : 'Earliest available doctor')
    : (selectedDoctorObj ? selectedDoctorObj.name : 'Earliest available doctor');

  if (srvEl) srvEl.textContent = selectedServiceObj ? selectedServiceObj.name : 'General Consultation';
  if (docEl) docEl.textContent = displayDocName;

  if (dateEl && selectedDateStr) {
    const d = new Date(selectedDateStr + 'T12:00:00');
    dateEl.textContent = d.toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  }

  if (timeEl) timeEl.textContent = selectedTimeStr || '—';

  // Also update Step 4 review elements
  const reviewSrv = document.getElementById('review-service');
  const reviewDoc = document.getElementById('review-doctor');
  const reviewDt = document.getElementById('review-datetime');
  const user = Storage.get(APP_CONFIG.STORAGE_KEYS.AUTH_USER);

  if (reviewSrv) reviewSrv.textContent = selectedServiceObj ? selectedServiceObj.name : 'General Consultation';
  if (reviewDoc) reviewDoc.textContent = displayDocName;
  if (reviewDt && selectedDateStr && selectedTimeStr) {
    const d = new Date(selectedDateStr + 'T12:00:00');
    const shortDay = d.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' });
    reviewDt.textContent = `${shortDay} · ${selectedTimeStr}`;
  } else if (reviewDt) {
    reviewDt.textContent = '—';
  }

  // Update recommended earliest match callout banner in Step 4
  const banner = document.getElementById('earliest-match-banner');
  const bannerText = document.getElementById('earliest-match-text');
  if (banner) {
    if (isEarliestDoctor && earliestMatchedDoctor && selectedDateStr && selectedTimeStr) {
      banner.style.display = 'flex';
      const d = new Date(selectedDateStr + 'T12:00:00');
      const dateText = d.toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
      if (bannerText) {
        bannerText.innerHTML = `We matched you with <strong>${Utils.escapeHtml(earliestMatchedDoctor.name)}</strong> for the earliest available consultation on <strong>${dateText}</strong> at <strong>${selectedTimeStr}</strong>. If this time works for you, submit your request below. If you prefer another date or time, click <em>Edit</em> next to Date &amp; time or click <em>Back</em> to change.`;
      }
    } else {
      banner.style.display = 'none';
    }
  }

  if (user) {
    const patName = document.getElementById('review-patient-name');
    const patMatric = document.getElementById('review-patient-matric');
    const patAvatar = document.getElementById('review-avatar');
    if (patName) patName.textContent = user.name;
    if (patMatric) patMatric.textContent = user.matricNo || 'Student';
    if (patAvatar) {
      patAvatar.textContent = (user.name || 'AY').split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();
    }
  }
}

async function autoSelectSlotForStep3() {
  const srvId = selectedServiceObj?.publicId || selectedServiceObj?.id;
  if (!srvId) return;

  if (isEarliestDoctor) {
    // 1. Try backend earliest-slot API if not in mock mode
    if (!APP_CONFIG.USE_MOCK_DATA) {
      try {
        const res = await MedicalService.getEarliestSlot(srvId);
        const data = res?.data || res;
        const appointment = data?.appointment;
        if (appointment && appointment.date && appointment.startTime) {
          const rawDate = String(appointment.date).slice(0, 10);
          const formattedTime = Utils.formatTime(appointment.startTime);
          if (rawDate >= localDate()) {
            selectedDateStr = rawDate;
            selectedTimeStr = formattedTime;

            const docData = appointment.doctor;
            if (docData) {
              const storedDocs = Storage.get(APP_CONFIG.STORAGE_KEYS.DOCTORS, []);
              const match = (storedDocs || []).find(d =>
                (docData.publicId && (d.publicId === docData.publicId || d.id === docData.publicId)) ||
                (docData.name && d.name === docData.name)
              );
              earliestMatchedDoctor = match || {
                id: docData.publicId || 'doc_assigned',
                publicId: docData.publicId || 'doc_assigned',
                name: docData.name || 'Assigned On-duty Physician',
                specialization: selectedServiceObj?.name || 'General Practitioner'
              };
              selectedDoctorObj = earliestMatchedDoctor;
            }

            initDates(selectedDateStr);
            await renderTimeSlots();
            updateSummary();
            return;
          }
        }
      } catch (err) {
        console.warn('[BookAppointment] Earliest slot API notice:', err.message);
      }
    }

    // 2. Scan forward from today for up to 30 days to locate the first free slot
    const today = new Date();
    for (let offset = 0; offset < 30; offset++) {
      const d = new Date(today);
      d.setDate(d.getDate() + offset);
      const dateStr = localDate(d);
      let daySlots = [];
      try {
        daySlots = await AppointmentService.getAvailableSlots({
          servicePublicId: srvId,
          date: dateStr,
          doctorPublicId: null
        });
      } catch {
        daySlots = availableSlots(srvId, null, dateStr);
      }
      const freeSlot = (daySlots || []).find(s => !s.full && s.status !== 'fully_booked');
      if (freeSlot) {
        selectedDateStr = dateStr;
        selectedTimeStr = freeSlot.time;
        const docData = freeSlot.doctor;
        if (docData) {
          const storedDocs = Storage.get(APP_CONFIG.STORAGE_KEYS.DOCTORS, []);
          const match = (storedDocs || []).find(d =>
            (docData.publicId && (d.publicId === docData.publicId || d.id === docData.publicId)) ||
            (docData.id && (d.id === docData.id || d.publicId === docData.id)) ||
            (docData.name && d.name === docData.name)
          );
          earliestMatchedDoctor = match || {
            id: docData.publicId || docData.id || 'doc_assigned',
            publicId: docData.publicId || docData.id || 'doc_assigned',
            name: docData.name || 'Assigned On-duty Physician',
            specialization: selectedServiceObj?.name || 'General Practitioner'
          };
          selectedDoctorObj = earliestMatchedDoctor;
        }
        initDates(selectedDateStr);
        await renderTimeSlots();
        updateSummary();
        return;
      }
    }

    // Fallback: render current date slots
    await renderTimeSlots();
    return;
  }

  // A specific doctor is selected:
  if (selectedDoctorObj) {
    const docId = selectedDoctorObj.publicId || selectedDoctorObj.id;
    const docStart = selectedDoctorObj.startTime || selectedDoctorObj.schedule?.startTime || selectedDoctorObj.rawStartTime;
    const docEnd = selectedDoctorObj.endTime || selectedDoctorObj.schedule?.endTime || selectedDoctorObj.rawEndTime;
    const docStartMin = minutes(docStart);
    const docEndMin = minutes(docEnd);

    // Check if the current selected date has free slots for this doctor
    let currentSlots = [];
    try {
      currentSlots = await AppointmentService.getAvailableSlots({
        servicePublicId: srvId,
        date: selectedDateStr,
        doctorPublicId: docId
      });
    } catch {
      currentSlots = availableSlots(srvId, docId, selectedDateStr);
    }
    if (Number.isFinite(docStartMin) && Number.isFinite(docEndMin) && docEndMin > docStartMin) {
      currentSlots = (currentSlots || []).filter(s => {
        const m = minutes(s.startTime || s.time);
        return Number.isFinite(m) && m >= docStartMin && (m + 30) <= docEndMin;
      });
    }
    const currentFree = (currentSlots || []).find(s => !s.full && s.status !== 'fully_booked');
    if (currentFree) {
      selectedTimeStr = currentFree.time;
      await renderTimeSlots();
      updateSummary();
      return;
    }

    // Otherwise scan ahead up to 14 days for doctor's next free date
    const today = new Date();
    for (let offset = 0; offset < 14; offset++) {
      const d = new Date(today);
      d.setDate(d.getDate() + offset);
      const dateStr = localDate(d);
      if (dateStr === selectedDateStr) continue;

      let daySlots = [];
      try {
        daySlots = await AppointmentService.getAvailableSlots({
          servicePublicId: srvId,
          date: dateStr,
          doctorPublicId: docId
        });
      } catch {
        daySlots = availableSlots(srvId, docId, dateStr);
      }
      if (Number.isFinite(docStartMin) && Number.isFinite(docEndMin) && docEndMin > docStartMin) {
        daySlots = (daySlots || []).filter(s => {
          const m = minutes(s.startTime || s.time);
          return Number.isFinite(m) && m >= docStartMin && (m + 30) <= docEndMin;
        });
      }
      const free = (daySlots || []).find(s => !s.full && s.status !== 'fully_booked');
      if (free) {
        initDates(dateStr);
        selectedTimeStr = free.time;
        await renderTimeSlots();
        updateSummary();
        return;
      }
    }

    await renderTimeSlots();
  }
}

function bindNavigationEvents() {
  const btnPrev = document.getElementById('btn-booking-prev');
  const btnNext = document.getElementById('btn-booking-next');

  if (btnPrev) {
    btnPrev.addEventListener('click', () => {
      if (currentStep > 1) {
        if (currentStep === 4 && skippedStep3) {
          skippedStep3 = false;
          goToStep(2);
          return;
        }
        goToStep(currentStep - 1);
      }
    });
  }

  if (btnNext) {
    btnNext.addEventListener('click', async () => {
      if (currentStep === 1 && !selectedServiceObj) { Toast.warning('No services are currently available.'); return; }
      if (currentStep === 3 && !selectedTimeStr) { Toast.warning('Choose an available date and time.'); return; }
      if (currentStep < 4) {
        // Validate referral if required
        if (currentStep === 1 && selectedServiceObj && selectedServiceObj.requiresReferral) {
          const input = document.getElementById('referral-code');
          if (!input || !input.value.trim()) {
            Toast.warning('Please enter a clinical referral code for this service.');
            if (input) input.focus();
            return;
          }
          referralCode = input.value.trim();
        }

        // When leaving Step 2 (Choose doctor), automatically find and select the earliest free slot
        if (currentStep === 2) {
          const originalText = btnNext.innerHTML;
          btnNext.disabled = true;
          btnNext.textContent = 'Finding earliest slot...';
          try {
            await autoSelectSlotForStep3();
          } catch (err) {
            console.warn('[BookAppointment] autoSelectSlot error:', err);
          } finally {
            btnNext.disabled = false;
            btnNext.innerHTML = originalText;
          }

          if (isEarliestDoctor) {
            skippedStep3 = true;
            goToStep(4);
            return;
          }
        }

        goToStep(currentStep + 1);
      } else {
        submitAppointmentRequest();
      }
    });
  }

  // Edit buttons in review step
  document.querySelectorAll('[data-goto-step]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const step = parseInt(btn.dataset.gotoStep, 10);
      if (step >= 1 && step <= 4) {
        if (step !== 4) skippedStep3 = false;
        goToStep(step);
      }
    });
  });

  // Stepper clicks for previous steps
  const stepper = document.getElementById('booking-stepper');
  if (stepper) {
    stepper.querySelectorAll('div[data-step]').forEach((item) => {
      item.addEventListener('click', () => {
        const targetStep = parseInt(item.dataset.step, 10);
        if (targetStep < currentStep) {
          if (targetStep !== 4) skippedStep3 = false;
          goToStep(targetStep);
        }
      });
    });
  }
}

function goToStep(step) {
  currentStep = step;

  if (step === 3) {
    initDates(selectedDateStr);
    renderTimeSlots();
  }

  // Update stepper UI
  const stepper = document.getElementById('booking-stepper');
  if (stepper) {
    stepper.querySelectorAll('div[data-step]').forEach((item) => {
      const s = parseInt(item.dataset.step, 10);
      item.classList.remove('active', 'done');
      const span = item.querySelector('span');

      if (s === currentStep) {
        item.classList.add('active');
        if (span) span.textContent = s;
      } else if (s < currentStep) {
        item.classList.add('done');
        if (span) {
          span.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
        }
      } else {
        if (span) span.textContent = s;
      }
    });
  }

  // Show/hide step panels
  document.querySelectorAll('.step-panel').forEach((panel) => {
    panel.classList.add('hidden');
  });

  const activePanel = document.getElementById(`step-panel-${currentStep}`);
  if (activePanel) activePanel.classList.remove('hidden');

  // Update buttons
  const btnPrev = document.getElementById('btn-booking-prev');
  const btnNext = document.getElementById('btn-booking-next');

  if (btnPrev) {
    if (currentStep === 1) {
      btnPrev.classList.add('hidden');
    } else {
      btnPrev.classList.remove('hidden');
    }
  }

  if (btnNext) {
    if (currentStep === 4) {
      btnNext.innerHTML = 'Submit Appointment Request';
    } else {
      btnNext.innerHTML = `Continue <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="9 18 15 12 9 6"></polyline></svg>`;
    }
  }

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function submitAppointmentRequest() {
  const agreement = document.getElementById('booking-agreement');
  if (agreement && !agreement.checked) {
    Toast.warning('Please confirm the appointment scheduling acknowledgment.');
    return;
  }

  const btnNext = document.getElementById('btn-booking-next');
  if (btnNext) {
    btnNext.disabled = true;
    btnNext.textContent = 'Submitting request…';
  }

  try {
    const user = Storage.get(APP_CONFIG.STORAGE_KEYS.AUTH_USER);
    const srvId = selectedServiceObj.publicId || selectedServiceObj.id;
    const assignedDoc = isEarliestDoctor ? (earliestMatchedDoctor || selectedDoctorObj) : selectedDoctorObj;
    const docId = assignedDoc?.publicId || assignedDoc?.id || null;
    const docName = assignedDoc?.name || (isEarliestDoctor ? 'Earliest Available' : 'Doctor');
    const result = await AppointmentService.createAppointment({
      studentId: user?.id,
      studentName: user?.name,
      matricNo: user?.matricNo,
      phone: user?.phone,
      serviceId: srvId,
      serviceName: selectedServiceObj.name,
      doctorId: docId,
      doctorName: docName,
      appointmentDate: selectedDateStr,
      timeSlot: selectedTimeStr,
      reason: document.getElementById('booking-reason')?.value.trim() || 'General consultation',
      referralCode: document.getElementById('referral-code')?.value.trim()
    });
    if (!result.success) { Toast.warning(result.message); renderTimeSlots(); return; }
    const { referenceNo: refCode, serviceName, doctorName } = result.appointment;
    const formattedDate = new Date(selectedDateStr + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    // Populate Confirmation Ticket
    const ticketRef = document.getElementById('ticket-reference');
    const ticketSrv = document.getElementById('ticket-service');
    const ticketDoc = document.getElementById('ticket-doctor');
    const ticketDate = document.getElementById('ticket-date');
    const ticketTime = document.getElementById('ticket-time');

    if (ticketRef) ticketRef.textContent = refCode;
    if (ticketSrv) ticketSrv.textContent = serviceName;
    if (ticketDoc) ticketDoc.textContent = doctorName || docName;
    if (ticketDate) ticketDate.textContent = formattedDate;
    if (ticketTime) ticketTime.textContent = selectedTimeStr;

    // Transition view
    const flowView = document.getElementById('booking-flow-view');
    const successView = document.getElementById('booking-success-view');

    if (flowView) flowView.classList.add('hidden');
    if (successView) successView.classList.remove('hidden');

    Toast.success('Appointment request submitted! Awaiting staff review.');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } catch (error) { Toast.error('Unable to save your appointment. Please try again.'); console.error(error); }
  finally { btnNext.disabled = false; btnNext.textContent = 'Submit Appointment Request'; }
}
