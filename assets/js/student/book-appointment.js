import { Utils } from '../core/utils.js';
import { availableSlots, localDate } from '../services/availability.js';
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
import { DoctorService } from '../services/doctor-service.js';
import { MedicalService } from '../services/medical-service.js';
import { INITIAL_SERVICES, INITIAL_APPOINTMENTS } from '../data/mock-data.js';

let currentStep = 1;
let selectedServiceObj = null;
let selectedDoctorObj = null; // null represents "Earliest available doctor"
let isEarliestDoctor = true;
let selectedDateStr = '';
let selectedTimeStr = '10:30 AM';
let referralCode = '';

document.addEventListener('DOMContentLoaded', async () => {
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
});

function initDates() {
  const dates = [];
  const today = new Date();
  
  // Build 5 operating days starting tomorrow or today
  const requestedDate = new URLSearchParams(location.search).get('date');
  let d = requestedDate && /^\d{4}-\d{2}-\d{2}$/.test(requestedDate) && requestedDate >= localDate() ? new Date(requestedDate + 'T12:00:00') : new Date(today);
  while (dates.length < 5) {
    // Exclude Sunday (0)
    {
      dates.push(new Date(d));
    }
    d.setDate(d.getDate() + 1);
  }

  selectedDateStr = dates[1] ? dates[1].toLocaleDateString('en-CA') : dates[0].toLocaleDateString('en-CA');
  const requested = new URLSearchParams(location.search).get('date');
  if (requested && requested >= localDate() && dates.some(d => localDate(d) === requested)) selectedDateStr = requested;
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
    btn.addEventListener('click', () => {
      container.querySelectorAll('button[data-date]').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      selectedDateStr = btn.dataset.date;
      updateDateSlotLabel();
      renderTimeSlots();
      updateSummary();
    });
  });

  for (const [id, direction] of [['btn-date-prev', -1], ['btn-date-next', 1]]) {
    const button = document.getElementById(id);
    button.disabled = direction === -1 && localDate(dates[0]) <= localDate();
    button.onclick = () => {
      const next = dates.map(date => { const value = new Date(date); value.setDate(value.getDate() + direction * 5); return value; });
      if (localDate(next[0]) < localDate()) return;
      selectedDateStr = localDate(next[0]);
      renderDateStrip(next); updateSummary();
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

  if (!slots.some(s => s.time === selectedTimeStr && !s.full)) {
    const firstAvailable = slots.find(s => !s.full);
    selectedTimeStr = firstAvailable ? firstAvailable.time : (slots[0]?.time || '');
  }

  if (!slots.length) {
    container.innerHTML = '<p class="capacity-guidance" style="grid-column: 1 / -1;">No available times on this date. Choose another date or doctor.</p>';
    selectedTimeStr = '';
    updateSummary();
    return;
  }

  container.innerHTML = slots.map((s) => {
    const isSelected = selectedTimeStr === s.time;
    return `
      <button type="button" class="${isSelected ? 'selected' : ''}" ${s.full ? 'disabled' : ''} data-time="${s.time}">
        ${s.time}
        ${s.full ? '<small>Full</small>' : ''}
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
    if (!Array.isArray(services) || services.length === 0) {
      container.innerHTML = `
        <div style="padding: var(--space-8); text-align: center; border: 1px solid var(--color-danger); border-radius: var(--radius-lg); background: var(--color-surface);">
          <p style="color: var(--color-danger); font-weight: 500; margin-bottom: var(--space-2);">Unable to load clinical services.</p>
          <p class="text-secondary" style="font-size: var(--font-size-xs); margin-bottom: var(--space-4);">${Utils.escapeHtml(err.message || 'Please check your connection and try again.')}</p>
          <button type="button" class="btn btn-outline-teal btn-sm" id="btn-retry-services">Retry Loading</button>
        </div>
      `;
      const retryBtn = document.getElementById('btn-retry-services');
      if (retryBtn) {
        retryBtn.addEventListener('click', () => initServices(paramDoctorId));
      }
      return;
    }
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
    const doc = Storage.get(APP_CONFIG.STORAGE_KEYS.DOCTORS, []).find(d => d.id === paramDoctorId);
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
    btn.addEventListener('click', () => {
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
      selectedDoctorObj = null; isEarliestDoctor = true;
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

  let storedDoctors = Storage.get(APP_CONFIG.STORAGE_KEYS.DOCTORS, []);
  if (!Array.isArray(storedDoctors) || storedDoctors.length === 0) {
    try {
      const avail = await DoctorService.getDoctorAvailability();
      storedDoctors = avail?.doctors || [];
    } catch {}
  }

  const doctors = (Array.isArray(storedDoctors) ? storedDoctors : []).filter(d => 
    doctorMatchesService(d, selectedServiceObj)
  );

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
      refreshDoctorSelectionUI(container);
      renderTimeSlots();
      updateSummary();
    });
  }

  // Doctor buttons listeners
  container.querySelectorAll('button[data-doctor-id]:not(:disabled)').forEach((btn) => {
    btn.addEventListener('click', () => {
      const docId = btn.dataset.doctorId;
      selectedDoctorObj = doctors.find((d) => d.id === docId);
      isEarliestDoctor = false;
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
    const selectedBtn = container.querySelector(`button[data-doctor-id="${selectedDoctorObj.id}"]`);
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

  if (srvEl) srvEl.textContent = selectedServiceObj ? selectedServiceObj.name : 'General Consultation';
  if (docEl) docEl.textContent = isEarliestDoctor ? 'Earliest available doctor' : (selectedDoctorObj ? selectedDoctorObj.name : 'Earliest available');
  
  if (dateEl && selectedDateStr) {
    const d = new Date(selectedDateStr + 'T12:00:00');
    dateEl.textContent = d.toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  }

  if (timeEl) timeEl.textContent = selectedTimeStr;

  // Also update Step 4 review elements
  const reviewSrv = document.getElementById('review-service');
  const reviewDoc = document.getElementById('review-doctor');
  const reviewDt = document.getElementById('review-datetime');
  const user = Storage.get(APP_CONFIG.STORAGE_KEYS.AUTH_USER);

  if (reviewSrv) reviewSrv.textContent = selectedServiceObj ? selectedServiceObj.name : 'General Consultation';
  if (reviewDoc) reviewDoc.textContent = isEarliestDoctor ? 'Earliest available doctor' : (selectedDoctorObj ? selectedDoctorObj.name : 'Earliest available');
  if (reviewDt && selectedDateStr) {
    const d = new Date(selectedDateStr + 'T12:00:00');
    const shortDay = d.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' });
    reviewDt.textContent = `${shortDay} · ${selectedTimeStr}`;
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

function bindNavigationEvents() {
  const btnPrev = document.getElementById('btn-booking-prev');
  const btnNext = document.getElementById('btn-booking-next');

  if (btnPrev) {
    btnPrev.addEventListener('click', () => {
      if (currentStep > 1) {
        goToStep(currentStep - 1);
      }
    });
  }

  if (btnNext) {
    btnNext.addEventListener('click', () => {
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
        goToStep(step);
      }
    });
  });
}

function goToStep(step) {
  currentStep = step;

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
    const docId = isEarliestDoctor ? null : (selectedDoctorObj?.publicId || selectedDoctorObj?.id);
    const result = await AppointmentService.createAppointment({
      studentId: user?.id,
      studentName: user?.name,
      matricNo: user?.matricNo,
      phone: user?.phone,
      serviceId: srvId,
      serviceName: selectedServiceObj.name,
      doctorId: docId,
      doctorName: isEarliestDoctor ? 'Earliest Available' : selectedDoctorObj?.name,
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
    if (ticketDoc) ticketDoc.textContent = doctorName;
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
