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
let hasServiceDoctors = false;

async function initBookingWizard() {
  if (!Navigation.requireAuth('student')) return;

  Header.render('Book an Appointment');
  StudentSidebar.render();

  await initServices();
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
  const docId = isEarliestDoctor
    ? (earliestMatchedDoctor?.publicId || earliestMatchedDoctor?.id)
    : (selectedDoctorObj?.publicId || selectedDoctorObj?.id);

  if (!docId) {
    container.innerHTML = `
      <p class="capacity-guidance" style="grid-column: 1 / -1; padding: var(--space-4); text-align: center;">
        No available doctor has been assigned yet. Please try again or choose a preferred doctor.
      </p>
    `;

    selectedTimeStr = '';
    updateSummary();
    return;
  }

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
    console.error('[BookAppointment] Error fetching slots:', err);

    container.innerHTML = `
      <p class="capacity-guidance" style="grid-column: 1 / -1; padding: var(--space-4); text-align: center;">
        Unable to load available times. Please try again.
      </p>
    `;

    selectedTimeStr = '';
    updateSummary();
    return;
  }

  if (!Array.isArray(slots) || slots.length === 0) {
    if (selectedDoctorObj && !isEarliestDoctor) {
      const docName = selectedDoctorObj.name || 'this physician';
      container.innerHTML = `
        <p class="capacity-guidance" style="grid-column: 1 / -1; padding: var(--space-4); text-align: center;">
          No available times for ${Utils.escapeHtml(docName)} on this date.
          Please choose another date or select <strong>Earliest available doctor</strong>.
        </p>
      `;
    } else {
      container.innerHTML = `
        <p class="capacity-guidance" style="grid-column: 1 / -1; padding: var(--space-4); text-align: center;">
          No available times on this date. Choose another date or doctor.
        </p>
      `;
    }

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

async function initServices() {
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
    console.error('[BookAppointment] Failed to load clinical services:', err);

    container.innerHTML = `
      <div class="capacity-guidance">
        Unable to load clinical services right now. Please try again.
      </div>
    `;
    return;
  }

  const openServices = (Array.isArray(services) ? services : [])
    .filter(s => s.status === 'open' || s.isActive === true);

  if (openServices.length === 0) {
    selectedServiceObj = null;
    selectedDoctorObj = null;
    isEarliestDoctor = true;
    earliestMatchedDoctor = null;
    selectedDateStr = '';
    selectedTimeStr = '';

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

  // Select the first service returned by the backend
  selectedServiceObj = openServices[0];
  selectedDoctorObj = null;
  isEarliestDoctor = true;
  earliestMatchedDoctor = null;
  selectedDateStr = '';
  selectedTimeStr = '';

  container.innerHTML = openServices.map((srv) => {
    const srvId = srv.publicId || srv.id;
    const isSelected = selectedServiceObj === srv;

    return `
      <button type="button" class="choice-card ${isSelected ? 'selected' : ''}" data-service-id="${Utils.escapeHtml(String(srvId))}">
        <span class="choice-radio">
          ${isSelected ? '<span></span>' : ''}
        </span>
        <span class="choice-copy">
          <strong>${Utils.escapeHtml(srv.name)}</strong>
          <small>${Utils.escapeHtml(srv.description || 'Consultation and clinical support')}</small>
          <span>${srv.requiresReferral ? 'Referral required' : 'No referral needed'}</span>
        </span>
      </button>
    `;
  }).join('');

  container.querySelectorAll('.choice-card').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const clickedId = btn.dataset.serviceId;

      selectedServiceObj = openServices.find(
        (s) => String(s.publicId || s.id) === clickedId
      );

      if (!selectedServiceObj) return;

      selectedDoctorObj = null;
      isEarliestDoctor = true;
      earliestMatchedDoctor = null;
      selectedDateStr = '';
      selectedTimeStr = '';
      skippedStep3 = false;

      container.querySelectorAll('.choice-card').forEach((b) => {
        b.classList.remove('selected');

        const radio = b.querySelector('.choice-radio');
        if (radio) radio.innerHTML = '';
      });

      btn.classList.add('selected');

      const radio = btn.querySelector('.choice-radio');
      if (radio) radio.innerHTML = '<span></span>';

      const referralWrap = document.getElementById('referral-field-container');
      if (referralWrap) {
        referralWrap.style.display = selectedServiceObj.requiresReferral ? 'flex' : 'none';
      }

      if (!selectedServiceObj.requiresReferral) {
        const referralInput = document.getElementById('referral-code');
        if (referralInput) referralInput.value = '';

        referralCode = '';
      }

      updateSummary();

      await initDoctors();
    });
  });

  const referralWrap = document.getElementById('referral-field-container');
  if (referralWrap) {
    referralWrap.style.display = selectedServiceObj.requiresReferral ? 'flex' : 'none';
  }

  updateSummary();

  await initDoctors();
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

async function initDoctors() {
	const container = document.getElementById('doctor-choices-container');
	const btnNext = document.getElementById('btn-booking-next');
	if (!container) return;

	const serviceId = selectedServiceObj?.publicId || selectedServiceObj?.id;

	// Clear previous service's doctor and appointment data
	hasServiceDoctors = false;
	selectedDoctorObj = null;
	isEarliestDoctor = true;
	earliestMatchedDoctor = null;
	selectedDateStr = '';
	selectedTimeStr = '';
	skippedStep3 = false;

	if (!serviceId) {
		container.innerHTML = `
			<div class="capacity-guidance">
				Select a clinical service first to view its doctors.
			</div>
		`;
		if (btnNext && currentStep === 2) btnNext.disabled = true;
		updateSummary();
		return;
	}

	if (btnNext && currentStep === 2) btnNext.disabled = true;

	container.innerHTML = `
		<div style="padding: var(--space-8); text-align: center;">
			<p class="text-secondary">Loading available doctors...</p>
		</div>
	`;

	updateSummary();

	let doctors = [];

	try {
		const rawDoctors = await MedicalService.getServiceDoctors(serviceId);

		doctors = (Array.isArray(rawDoctors) ? rawDoctors : [])
			.map(fromBackendDoctor)
			.filter(Boolean);

	} catch (err) {
		console.error('[BookAppointment] Failed to load service doctors:', err);

		const currentServiceId = selectedServiceObj?.publicId || selectedServiceObj?.id;
		if (String(currentServiceId) !== String(serviceId)) return;

		container.innerHTML = `
			<div class="capacity-guidance">
				Unable to load doctors right now. Please try again.
			</div>
		`;
		if (btnNext && currentStep === 2) btnNext.disabled = true;
		updateSummary();
		return;
	}

	// Ignore results if the student has changed the selected service
	const currentServiceId = selectedServiceObj?.publicId || selectedServiceObj?.id;

	if (String(currentServiceId) !== String(serviceId)) return;

	if (doctors.length === 0) {
		container.innerHTML = `
			<div class="capacity-guidance">
				No doctors are currently assigned to this clinical service.
				Please choose another service or contact the clinic reception.
			</div>
		`;
		if (btnNext && currentStep === 2) btnNext.disabled = true;
		updateSummary();
		return;
	}

	hasServiceDoctors = true;

	const earliestCardHtml = `
		<button type="button" class="choice-card feature-choice ${isEarliestDoctor ? 'selected' : ''}" id="choice-earliest-doc">
			<span class="choice-radio">
				${isEarliestDoctor ? '<span></span>' : ''}
			</span>
			<span class="choice-copy">
				<strong>Earliest available doctor</strong>
				<small>We'll assign the earliest available clinical officer.</small>
			</span>
		</button>
	`;

	const doctorsHtml = doctors.map((doc) => {
		const docId = doc.publicId || doc.id;
		const isSelected = !isEarliestDoctor && String(selectedDoctorObj?.publicId || selectedDoctorObj?.id) === String(docId);

		const parts = (doc.name || 'Doctor').replace(/^Dr\.?\s+/i, '').split(' ');
		const initials = parts.map((p) => p[0]).slice(0, 2).join('').toUpperCase();

		return `
			<button type="button" class="choice-card ${isSelected ? 'selected' : ''}" data-doctor-id="${Utils.escapeHtml(String(docId))}">
				<span class="choice-radio">
					${isSelected ? '<span></span>' : ''}
				</span>
				<span class="doctor-avatar small">${Utils.escapeHtml(initials)}</span>
				<span class="choice-copy">
					<strong>${Utils.escapeHtml(doc.name || 'Doctor')}</strong>
					<small>${Utils.escapeHtml(doc.specialization || doc.specialty || 'General Practitioner')}</small>
				</span>
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
			<span>No slots with your preferred doctor? Try the earliest available doctor or another date.</span>
		</div>
	`;

	container.innerHTML = earliestCardHtml + doctorsHtml + guidanceHtml;

	if (btnNext && currentStep === 2) btnNext.disabled = false;

	// Earliest doctor option listener
	const earliestBtn = document.getElementById('choice-earliest-doc');

	if (earliestBtn) {
		earliestBtn.addEventListener('click', async () => {
			// Reset the previous appointment selection
			isEarliestDoctor = true;
			selectedDoctorObj = null;
			earliestMatchedDoctor = null;
			selectedDateStr = '';
			selectedTimeStr = '';
			skippedStep3 = false;

			// Prevent duplicate requests while checking availability
			container.querySelectorAll('button').forEach((button) => {
				button.disabled = true;
			});

			if (btnNext) btnNext.disabled = true;

			refreshDoctorSelectionUI(container);
			updateSummary();

			try {
				// Fetch a fresh earliest available appointment
				await autoSelectSlotForStep3({ prepareOnly: true });

				if (!earliestMatchedDoctor || !selectedDateStr || !selectedTimeStr) {
					Toast.warning('No available appointment was found. Please try again or choose a preferred doctor.');
				}
			} catch (err) {
				console.error('[BookAppointment] Earliest availability search failed:', err);
				Toast.error('Unable to find the earliest appointment. Please try again.');
			} finally {
				container.querySelectorAll('button').forEach((button) => {
					button.disabled = false;
				});

				if (btnNext) btnNext.disabled = !hasServiceDoctors;

				updateSummary();
			}
		});
	}

		// Specific doctor selection listeners
	container.querySelectorAll('button[data-doctor-id]').forEach((btn) => {
		btn.addEventListener('click', () => {
			const docId = btn.dataset.doctorId;

			selectedDoctorObj = doctors.find(
				(d) => String(d.publicId || d.id) === docId
			);

			if (!selectedDoctorObj) return;

			isEarliestDoctor = false;
			earliestMatchedDoctor = null;
			selectedDateStr = '';
			selectedTimeStr = '';
			skippedStep3 = false;

			refreshDoctorSelectionUI(container);
			updateSummary();
		});
	});

	updateSummary();
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
	const displayDocName = isEarliestDoctor
		? (earliestMatchedDoctor?.name || 'Earliest available doctor')
		: (selectedDoctorObj?.name || 'Not selected');

	const displayDate = selectedDateStr
		? Utils.formatDate(selectedDateStr)
		: 'Not selected';

	const displayTime = selectedTimeStr || 'Not selected';

	const assignedDoctor = isEarliestDoctor
		? earliestMatchedDoctor
		: selectedDoctorObj;

	const displayLocation = assignedDoctor?.location ||
		assignedDoctor?.consultingRoom ||
		assignedDoctor?.room ||
		'Location not assigned';

	const serviceEl = document.getElementById('review-service');
	const doctorEl = document.getElementById('review-doctor');
	const dateTimeEl = document.getElementById('review-datetime');
	const locationEl = document.getElementById('review-location');

	const summaryServiceEl = document.getElementById('summary-service');
	const summaryDoctorEl = document.getElementById('summary-doctor');
	const summaryDateEl = document.getElementById('summary-date');
	const summaryTimeEl = document.getElementById('summary-time');
	const summaryLocationEl = document.getElementById('summary-location');

	// Update Step 4 review details
	if (serviceEl) {
		serviceEl.textContent = selectedServiceObj?.name || 'Not selected';
	}

	if (doctorEl) {
		doctorEl.textContent = displayDocName;
	}

	if (dateTimeEl) {
		dateTimeEl.textContent = selectedDateStr && selectedTimeStr
			? `${displayDate} · ${displayTime}`
			: 'Not selected';
	}

	if (locationEl) {
		locationEl.textContent = displayLocation;
	}

	// Update right-side booking summary
	if (summaryServiceEl) {
		summaryServiceEl.textContent = selectedServiceObj?.name || '—';
	}

	if (summaryDoctorEl) {
		summaryDoctorEl.textContent = currentStep === 1
			? '—'
			: displayDocName;
	}

	if (summaryDateEl) {
		summaryDateEl.textContent = selectedDateStr
			? displayDate
			: '—';
	}

	if (summaryTimeEl) {
		summaryTimeEl.textContent = selectedTimeStr || '—';
	}

	if (summaryLocationEl) {
		summaryLocationEl.textContent = currentStep === 1
			? '—'
			: displayLocation;
	}

	// Hide doctor and date/time editing when using automatic doctor assignment
	const doctorEditButton = document.querySelector('[data-goto-step="2"]');
	const datetimeEditButton = document.querySelector('[data-goto-step="3"]');

	if (doctorEditButton) {
		doctorEditButton.hidden = isEarliestDoctor;
	}

	if (datetimeEditButton) {
		datetimeEditButton.hidden = isEarliestDoctor;
	}

	// Keep the earliest availability guidance in sync
	const earliestBanner = document.getElementById('earliest-match-banner');

	if (earliestBanner) {
		const shouldShowBanner = (
			currentStep === 4 &&
			isEarliestDoctor &&
			!!earliestMatchedDoctor &&
			!!selectedDateStr &&
			!!selectedTimeStr
		);

		earliestBanner.style.display = shouldShowBanner ? 'flex' : 'none';
	}
}

async function autoSelectSlotForStep3({ prepareOnly = false } = {}) {
  const srvId = selectedServiceObj?.publicId || selectedServiceObj?.id;
  if (!srvId || !hasServiceDoctors) return;

  if (isEarliestDoctor) {
    // 1. Try the backend earliest-slot API first
    if (!APP_CONFIG.USE_MOCK_DATA) {
      try {
        const res = await MedicalService.getEarliestSlot(srvId);
        const currentServiceId = selectedServiceObj?.publicId || selectedServiceObj?.id;

        if (String(currentServiceId) !== String(srvId)) return;

        const data = res?.data || res;
        const appointment = data?.appointment;

        if (
          appointment?.date &&
          appointment?.startTime &&
          appointment?.doctor?.publicId
        ) {
          const rawDate = String(appointment.date).slice(0, 10);
          const formattedTime = Utils.formatTime(appointment.startTime);

          if (rawDate >= localDate()) {
            selectedDateStr = rawDate;
            selectedTimeStr = formattedTime;
            earliestMatchedDoctor = appointment.doctor;

            if (!prepareOnly) {
              initDates(selectedDateStr);
              await renderTimeSlots();
            }

            updateSummary();
            return;
          }
        }
      } catch (err) {
        console.warn(
          '[BookAppointment] Earliest slot API notice:',
          err?.message || String(err)
        );
      }
    }

    // 2. Load doctors assigned to the selected service
    let doctors = [];

    try {
      const rawDoctors = await MedicalService.getServiceDoctors(srvId);

      doctors = (Array.isArray(rawDoctors) ? rawDoctors : [])
        .map(fromBackendDoctor)
        .filter((doctor) => doctor && (doctor.publicId || doctor.id));

    } catch (err) {
      console.warn(
        '[BookAppointment] Unable to load doctors for earliest availability:',
        err?.message || String(err)
      );
      return;
    }

    const currentServiceId = selectedServiceObj?.publicId || selectedServiceObj?.id;
    if (String(currentServiceId) !== String(srvId)) return;

    if (doctors.length === 0) {
      earliestMatchedDoctor = null;
      selectedDateStr = '';
      selectedTimeStr = '';
      updateSummary();
      return;
    }

    // 3. Scan forward and check each doctor's availability
    const today = new Date();

    for (let offset = 0; offset < 30; offset++) {
      const d = new Date(today);
      d.setDate(d.getDate() + offset);

      const dateStr = localDate(d);
      const availableMatches = [];

      for (const doctor of doctors) {
        const docId = doctor.publicId || doctor.id;
        if (!docId) continue;

        let daySlots = [];

        try {
          daySlots = await AppointmentService.getAvailableSlots({
            servicePublicId: srvId,
            date: dateStr,
            doctorPublicId: docId
          });

        } catch (err) {
          console.warn(
            `[BookAppointment] Unable to check slots for ${doctor.name || docId} on ${dateStr}:`,
            err?.message || String(err)
          );
          continue;
        }

        const currentServiceId = selectedServiceObj?.publicId || selectedServiceObj?.id;
        if (String(currentServiceId) !== String(srvId)) return;

        const freeSlot = Array.isArray(daySlots)
          ? daySlots.find(
              (slot) =>
                !slot.full &&
                slot.status === 'available' &&
                slot.time
            )
          : null;

        if (freeSlot) {
          availableMatches.push({
            slot: freeSlot,
            doctor
          });
        }
      }

      // Find the earliest time across all doctors for this date
      if (availableMatches.length > 0) {
        availableMatches.sort((a, b) =>
          String(a.slot.startTime || a.slot.time)
            .localeCompare(String(b.slot.startTime || b.slot.time))
        );

        const earliestMatch = availableMatches[0];

        selectedDateStr = dateStr;
        selectedTimeStr = earliestMatch.slot.time;
        earliestMatchedDoctor = earliestMatch.doctor;

        if (!prepareOnly) {
          initDates(selectedDateStr);
          await renderTimeSlots();
        }

        updateSummary();
        return;
      }
    }

    // No available slot was found within the search window
    earliestMatchedDoctor = null;
    selectedDateStr = '';
    selectedTimeStr = '';

    if (!prepareOnly) {
      await renderTimeSlots();
    }

    updateSummary();
    return;
  }

  // 4. A specific doctor is selected
  if (selectedDoctorObj) {
    const docId = selectedDoctorObj.publicId || selectedDoctorObj.id;
    if (!docId) return;

    // Check the current selected date first
    let currentSlots = [];

    try {
      currentSlots = await AppointmentService.getAvailableSlots({
        servicePublicId: srvId,
        date: selectedDateStr,
        doctorPublicId: docId
      });

    } catch (err) {
      console.warn(
        '[BookAppointment] Unable to check doctor slots:',
        err?.message || String(err)
      );

      if (!prepareOnly) await renderTimeSlots();
      return;
    }

    const currentServiceId = selectedServiceObj?.publicId || selectedServiceObj?.id;
    if (String(currentServiceId) !== String(srvId)) return;

    const currentFree = Array.isArray(currentSlots)
      ? currentSlots.find(
          (slot) => !slot.full && slot.status === 'available'
        )
      : null;

    if (currentFree) {
      selectedTimeStr = currentFree.time;

      if (!prepareOnly) {
        await renderTimeSlots();
      }

      updateSummary();
      return;
    }

    // Otherwise scan ahead up to 14 days for this doctor's next available date
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

      } catch (err) {
        console.warn(
          '[BookAppointment] Unable to check doctor next available date:',
          err?.message || String(err)
        );
        continue;
      }

      const currentServiceId = selectedServiceObj?.publicId || selectedServiceObj?.id;
      if (String(currentServiceId) !== String(srvId)) return;

      const free = Array.isArray(daySlots)
        ? daySlots.find(
            (slot) => !slot.full && slot.status === 'available'
          )
        : null;

      if (free) {
        initDates(dateStr);
        selectedTimeStr = free.time;

        if (!prepareOnly) {
          await renderTimeSlots();
        }

        updateSummary();
        return;
      }
    }

    if (!prepareOnly) {
      await renderTimeSlots();
    }
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

        // When leaving Step 2, use the earliest slot already fetched
        if (currentStep === 2 && isEarliestDoctor) {
          if (!earliestMatchedDoctor || !selectedDateStr || !selectedTimeStr) {
            Toast.warning('No earliest appointment slot is currently available. Please choose a doctor.');
            return;
          }

          skippedStep3 = true;
          goToStep(4);
          return;
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

      if (isEarliestDoctor && (step === 2 || step === 3)) return;

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
          if (isEarliestDoctor && targetStep === 3) return;
          if (targetStep !== 4) skippedStep3 = false;
          goToStep(targetStep);
        }
      });
    });
  }
}

function goToStep(step) {
	if (step === 3 && isEarliestDoctor) return;

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

		btnNext.disabled = currentStep === 2 &&
			!document.querySelector('#doctor-choices-container #choice-earliest-doc, #doctor-choices-container button[data-doctor-id]');
	}

	updateSummary();

	// Automatically find the earliest available doctor when entering Step 2
	if (
		currentStep === 2 &&
		isEarliestDoctor &&
		hasServiceDoctors &&
		!earliestMatchedDoctor
	) {
		const doctorButtons = document.querySelectorAll('#doctor-choices-container button');

		doctorButtons.forEach((button) => {
			button.disabled = true;
		});

		if (btnNext) btnNext.disabled = true;

		autoSelectSlotForStep3({ prepareOnly: true })
			.catch((error) => {
				console.error('Failed to find earliest available doctor:', error);
				Toast.error('Unable to find the earliest available appointment. Please try again.');
			})
			.finally(() => {
				doctorButtons.forEach((button) => {
					button.disabled = false;
				});

				if (btnNext) btnNext.disabled = !hasServiceDoctors;

				updateSummary();
			});
	}

	window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function submitAppointmentRequest() {
	const agreement = document.getElementById('booking-agreement');

	if (agreement && !agreement.checked) {
		Toast.warning('Please confirm the appointment scheduling acknowledgment.');
		return;
	}

	if (!selectedServiceObj || !selectedDateStr || !selectedTimeStr) {
		Toast.warning('Please complete all required appointment details.');
		return;
	}

	const assignedDoc = isEarliestDoctor
		? (earliestMatchedDoctor || selectedDoctorObj)
		: selectedDoctorObj;

	if (!assignedDoc || !(assignedDoc.publicId || assignedDoc.id)) {
		Toast.warning('No doctor has been assigned to this appointment.');
		return;
	}

	const btnNext = document.getElementById('btn-booking-next');

	if (btnNext?.disabled) return;

	if (btnNext) {
		btnNext.disabled = true;
		btnNext.textContent = 'Submitting request…';
	}

	try {
		const user = Storage.get(APP_CONFIG.STORAGE_KEYS.AUTH_USER);
		const srvId = selectedServiceObj.publicId || selectedServiceObj.id;
		const docId = assignedDoc.publicId || assignedDoc.id;
		const docName = assignedDoc.name || 'Doctor';

		const doctorLocation =
			assignedDoc.location ||
			assignedDoc.consultingRoom ||
			assignedDoc.room ||
			assignedDoc.schedule?.consultingRoom ||
			'Location not assigned';

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

		if (!result.success) {
			Toast.warning(result.message || 'Unable to submit your appointment request.');
			await renderTimeSlots();
			return;
		}

		const {
			referenceNo: refCode,
			serviceName,
			doctorName: confirmedDoctorName
		} = result.appointment;

		const formattedDate = new Date(selectedDateStr + 'T12:00:00')
			.toLocaleDateString('en-GB', {
				weekday: 'long',
				day: 'numeric',
				month: 'long',
				year: 'numeric'
			});

		// Populate Confirmation Ticket
		const ticketRef = document.getElementById('ticket-reference');
		const ticketSrv = document.getElementById('ticket-service');
		const ticketDoc = document.getElementById('ticket-doctor');
		const ticketDate = document.getElementById('ticket-date');
		const ticketTime = document.getElementById('ticket-time');
		const ticketLocation = document.getElementById('ticket-location');

		if (ticketRef) ticketRef.textContent = refCode || '—';
		if (ticketSrv) ticketSrv.textContent = serviceName || selectedServiceObj.name;
		if (ticketDoc) ticketDoc.textContent = confirmedDoctorName || docName;
		if (ticketDate) ticketDate.textContent = formattedDate;
		if (ticketTime) ticketTime.textContent = selectedTimeStr;
		if (ticketLocation) ticketLocation.textContent = doctorLocation;

		// Transition view
		const flowView = document.getElementById('booking-flow-view');
		const successView = document.getElementById('booking-success-view');

		if (flowView) flowView.classList.add('hidden');
		if (successView) successView.classList.remove('hidden');

		Toast.success('Appointment request submitted! Awaiting staff review.');
		window.scrollTo({ top: 0, behavior: 'smooth' });

	} catch (error) {
		console.error('[BookAppointment] Appointment submission failed:', error);
		Toast.error(error?.message || 'Unable to save your appointment. Please try again.');
	} finally {
		if (btnNext) {
			btnNext.disabled = false;
			btnNext.textContent = 'Submit Appointment Request';
		}
	}
}

