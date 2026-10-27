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
import { INITIAL_SERVICES, INITIAL_APPOINTMENTS } from '../data/mock-data.js';

let currentStep = 1;
let selectedServiceObj = null;
let selectedDoctorObj = null; // null represents "Earliest available doctor"
let isEarliestDoctor = true;
let selectedDateStr = '';
let selectedTimeStr = '10:30 AM';
let referralCode = '';

document.addEventListener('DOMContentLoaded', () => {
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
  initServices(paramDoctorId);
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

function renderTimeSlots() {
  const container = document.getElementById('time-grid-container');
  if (!container) return;

  const slots = availableSlots(selectedServiceObj?.id, isEarliestDoctor ? null : selectedDoctorObj?.id, selectedDateStr);
  if (!slots.some(s => s.time === selectedTimeStr)) selectedTimeStr = slots[0]?.time || '';
  if (!slots.length) { container.innerHTML = '<p class="capacity-guidance">No available times on this date. Choose another date or doctor.</p>'; return; }

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
}

function initServices(paramDoctorId) {
  const container = document.getElementById('service-options-container');
  if (!container) return;

  const services = Storage.get(APP_CONFIG.STORAGE_KEYS.SERVICES, []);
  if (services.length > 0) {
    selectedServiceObj = services.find(s => s.isActive) || null;
    if (paramDoctorId) { const doc = Storage.get(APP_CONFIG.STORAGE_KEYS.DOCTORS, []).find(d => d.id === paramDoctorId); selectedServiceObj = services.find(s => s.id === doc?.serviceId && s.isActive) || selectedServiceObj; }
  }

  container.innerHTML = services.map((srv, idx) => {
    const isSelected = selectedServiceObj && selectedServiceObj.id === srv.id;
    const isClosed = srv.isActive === false;
    return `
      <button type="button" class="choice-card ${isSelected ? 'selected' : ''}" data-service-id="${srv.id}" ${isClosed ? 'disabled' : ''}>
        <span class="choice-radio">
          ${isSelected ? '<span></span>' : ''}
        </span>
        <span class="choice-copy">
          <strong>${Utils.escapeHtml(srv.name)}</strong>
          <small>${srv.description || 'Consultation and clinical support'}</small>
          <span>${srv.requiresReferral ? 'Referral required' : 'No referral needed'}</span>
        </span>
        ${isClosed ? '<span class="badge badge-danger">Temporarily closed</span>' : ''}
      </button>
    `;
  }).join('');

  container.querySelectorAll('.choice-card:not(:disabled)').forEach((btn) => {
    btn.addEventListener('click', () => {
      const srvId = btn.dataset.serviceId;
      selectedServiceObj = services.find((s) => s.id === srvId) || services[0];
      
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
        referralWrap.style.display = selectedServiceObj.requiresReferral ? 'flex' : 'none';
      }

      updateSummary();
      selectedDoctorObj = null; isEarliestDoctor = true;
      initDoctors();
      renderTimeSlots();
    });
  });

  initDoctors(paramDoctorId);
  document.getElementById('referral-field-container').style.display = selectedServiceObj?.requiresReferral ? 'flex' : 'none';
  renderTimeSlots();
  updateSummary();
}

function initDoctors(paramDoctorId) {
  const container = document.getElementById('doctor-choices-container');
  if (!container) return;

  const doctors = Storage.get(APP_CONFIG.STORAGE_KEYS.DOCTORS, []).filter(d => d.serviceId === selectedServiceObj?.id);

  // Pre-selection if paramDoctorId provided
  if (paramDoctorId) {
    const match = doctors.find((d) => d.id === paramDoctorId);
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
    const isSelected = !isEarliestDoctor && selectedDoctorObj && selectedDoctorObj.id === doc.id;
    const capacity = doc.dailyCapacity || 25;
    const currentLoad = doc.currentLoad || 0;
    const isFull = false; // Date-specific attendance is enforced by availableSlots.
    const slotsRemaining = Math.max(0, capacity - currentLoad);

    const parts = (doc.name || 'Doctor').replace(/^Dr\.?\s+/i, '').split(' ');
    const initials = parts.map((p) => p[0]).slice(0, 2).join('').toUpperCase();

    return `
      <button type="button" class="choice-card ${isSelected ? 'selected' : ''}" data-doctor-id="${doc.id}" ${isFull ? 'disabled' : ''}>
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
    const result = await AppointmentService.createAppointment({
      studentId: user.id, studentName: user.name, matricNo: user.matricNo, phone: user.phone,
      serviceId: selectedServiceObj.id, serviceName: selectedServiceObj.name,
      doctorId: isEarliestDoctor ? null : selectedDoctorObj?.id,
      appointmentDate: selectedDateStr, timeSlot: selectedTimeStr,
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
