import { availableSlots } from '../services/availability.js';
import { Storage } from '../core/storage.js';
import { Navigation } from '../core/navigation.js';
/**
 * Care-OAU - Admin Appointment Management Logic
 * Handles request triage (approve/reject), patient arrival check-in with sequential
 * queue ticket generation, rescheduling, and hospital referrals.
 */

import { AppointmentService } from '../services/appointment-service.js';
import { AdminSidebar } from '../components/admin-sidebar.js';
import { Header } from '../components/header.js';
import { Toast } from '../components/toast.js';
import { Modal } from '../components/modal.js';
import { Utils } from '../core/utils.js';
import { APP_CONFIG } from '../core/config.js';
import { SyncManager } from '../core/sync-manager.js';

let activeFilter = 'all';
let searchQuery = '';
let adminAppointmentsPoller = null;

document.addEventListener('DOMContentLoaded', () => {
  if (!Navigation.requireAuth('admin')) return;
  Header.render('Appointment Management & Check-in');
  AdminSidebar.render();

  initControls();
  loadAppointments();

  adminAppointmentsPoller = SyncManager.createPoller({
    name: 'admin-appointments-sync',
    interval: 8000,
    fetchFn: () => loadAppointments(),
    immediate: false
  });
  adminAppointmentsPoller.start();
});

function initControls() {
  const searchInput = document.getElementById('admin-apt-search');

  if (searchInput) {
    searchInput.addEventListener('input', Utils.debounce((e) => {
      searchQuery = e.target.value.toLowerCase().trim();
      loadAppointments();
    }, 250));
  }

  const tabs = document.getElementById('admin-status-tabs');

  if (tabs) {
    tabs.querySelectorAll('.tab-filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        tabs.querySelectorAll('.tab-filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        activeFilter = btn.dataset.filter;
        loadAppointments();
      });
    });
  }

  // Handle appointment card actions through event delegation.
  const appointmentList = document.getElementById('admin-appointments-list');

  if (appointmentList) {
    appointmentList.addEventListener('click', async (event) => {
      const actionElement = event.target.closest('[data-action]');
      if (!actionElement) return;

      const { action, id } = actionElement.dataset;

      if (!id) return;

      switch (action) {
        case 'approve':
          await window.adminApprove(id);
          break;

        case 'reject':
          window.adminReject(id);
          break;

        case 'check-in':
          await window.adminCheckIn(id);
          break;

        case 'complete':
          window.adminComplete(id);
          break;

        case 'reschedule': {
          const apt = (await AppointmentService.getAllAppointments())
            .find(item => String(item.id) === id);

          if (apt) {
            window.adminReschedule(id, apt.appointmentDate, apt.timeSlot);
          }
          break;
        }

        case 'refer':
          await window.adminIssueReferral(id);
          break;

        case 'details':
          await window.adminViewDetails(id);
          break;
      }
    });
  }

  // Appointment details modal controls.
  const detailsModal = document.getElementById('appointment-details-modal');
  const closeButton = document.getElementById('appointment-modal-close');

  if (closeButton && detailsModal) {
    closeButton.addEventListener('click', () => {
      detailsModal.hidden = true;
    });

    detailsModal.addEventListener('click', (event) => {
      if (event.target === detailsModal) {
        detailsModal.hidden = true;
      }
    });
  }

  const primaryButton = document.getElementById('appointment-modal-primary-action');
  const rescheduleButton = document.getElementById('appointment-modal-reschedule');
  const rejectButton = document.getElementById('appointment-modal-reject');

  if (primaryButton) {
    primaryButton.addEventListener('click', () => {
      if (!window.currentAdminAppointment) return;

      const apt = window.currentAdminAppointment;
      const status = getAppointmentStatus(apt.status);

      detailsModal.hidden = true;

      if (status === 'Pending') window.adminApprove(apt.id);
      if (status === 'Approved') window.adminCheckIn(apt.id);
      if (status === 'Checked In') window.adminComplete(apt.id);
    });
  }

  if (rescheduleButton) {
    rescheduleButton.addEventListener('click', () => {
      const apt = window.currentAdminAppointment;
      if (!apt) return;

      detailsModal.hidden = true;
      window.adminReschedule(apt.id, apt.appointmentDate, apt.timeSlot);
    });
  }

  if (rejectButton) {
    rejectButton.addEventListener('click', () => {
      const apt = window.currentAdminAppointment;
      if (!apt) return;

      detailsModal.hidden = true;
      window.adminReject(apt.id);
    });
  }
}

// Above load appointment 

function escape(value) {
  return Utils.escapeHtml(String(value ?? ''));
}

function getAppointmentStatus(status) {
  if (status === 'Pending Approval') return 'Pending';
  return status || 'Pending';
}

function getStatusClass(status) {
  const classes = {
    'Pending': 'status-pending',
    'Approved': 'status-approved',
    'Checked In': 'status-checked-in',
    'Completed': 'status-completed',
    'Rejected': 'status-rejected',
    'Cancelled': 'status-cancelled'
  };

  return classes[getAppointmentStatus(status)] || 'status-pending';
}

function getInitials(name) {
  return String(name || 'Student')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(part => part.charAt(0).toUpperCase())
    .join('');
}

function getAppointmentDateKey(date) {
  return String(date || '').slice(0, 10);
}

function getAppointmentDateLabel(date) {
  const today = Utils.getTodayDateString();
  const dateKey = getAppointmentDateKey(date);

  const tomorrowDate = new Date(`${today}T00:00:00`);
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);

  const tomorrow = [
    tomorrowDate.getFullYear(),
    String(tomorrowDate.getMonth() + 1).padStart(2, '0'),
    String(tomorrowDate.getDate()).padStart(2, '0')
  ].join('-');

  const parsedDate = new Date(`${dateKey}T00:00:00`);

  if (dateKey === today) {
    return `Today · ${Utils.formatDate(date)}`;
  }

  if (dateKey === tomorrow) {
    return `Tomorrow · ${Utils.formatDate(date)}`;
  }

  return Utils.formatDate(date);
}

function getAppointmentTimeValue(time) {
  const match = String(time || '').match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);

  if (!match) return 0;

  let hours = Number(match[1]);
  const minutes = Number(match[2]);
  const period = match[3]?.toUpperCase();

  if (period === 'PM' && hours !== 12) hours += 12;
  if (period === 'AM' && hours === 12) hours = 0;

  return (hours * 60) + minutes;
}

function renderAppointmentActions(apt, status) {
  const id = escape(apt.id);

  let primaryAction = '';

  if (status === 'Pending') {
    primaryAction = `
      <button type="button" class="btn btn-approve btn-sm"
        data-action="approve" data-id="${id}">
        Approve
      </button>
    `;
  } else if (status === 'Approved') {
    primaryAction = `
      <button type="button" class="btn btn-teal btn-sm"
        data-action="check-in" data-id="${id}">
        Check In
      </button>
    `;
  } else if (status === 'Checked In') {
    primaryAction = `
      <button type="button" class="btn btn-navy btn-sm"
        data-action="complete" data-id="${id}">
        Complete
      </button>
    `;
  }

  let menuActions = '';

  if (status === 'Pending') {
    menuActions = `
      <button type="button" data-action="reject" data-id="${id}">
        Reject Appointment
      </button>
      <button type="button" data-action="reschedule" data-id="${id}">
        Reschedule
      </button>
    `;
  } else if (status === 'Approved') {
    menuActions = `
      <button type="button" data-action="refer" data-id="${id}">
        Issue Referral
      </button>
      <button type="button" data-action="reschedule" data-id="${id}">
        Reschedule
      </button>
    `;
  } else if (status === 'Checked In') {
    menuActions = `
      <a href="queue-management.html">
        View Queue
      </a>
    `;
  }

  menuActions += `
    <button type="button" data-action="details" data-id="${id}">
      View Details
    </button>
  `;

  return `
    <div class="appointment-card-actions">

      ${primaryAction}

      <details class="appointment-actions-menu">
        <summary aria-label="More appointment actions" title="More actions">
          &hellip;
        </summary>

        <div class="appointment-actions-dropdown">
          ${menuActions}
        </div>
      </details>

    </div>
  `;
}

function renderAppointmentCard(apt) {
  const status = getAppointmentStatus(apt.status);
  const statusClass = getStatusClass(status);
  const id = escape(apt.id);

  return `
    <article class="appointment-card ${statusClass}" data-appointment-id="${id}">

      <div class="appointment-card-main">

        <!-- STUDENT INFORMATION -->
        <div class="appointment-card-student">

          <div class="appointment-avatar">
            ${escape(getInitials(apt.studentName))}
          </div>

          <div class="appointment-student-info">
            <h4>${escape(apt.studentName || 'Unknown Student')}</h4>
            <p>${escape(apt.matricNo || 'No matric number')}</p>
            <span>${escape(apt.phone || 'No phone number')}</span>
          </div>

        </div>

        <!-- SERVICE AND APPOINTMENT INFORMATION -->
        <div class="appointment-card-info">

          <div class="appointment-info-item">
            <span>Service</span>
            <strong>${escape(apt.serviceName || 'General Consultation')}</strong>
          </div>

          <div class="appointment-info-item">
            <span>Assigned Doctor</span>
            <strong>${escape(apt.doctorName || 'Medical Officer')}</strong>
          </div>

          <div class="appointment-info-item">
            <span>Time</span>
            <strong>${escape(apt.timeSlot || '--')}</strong>

            ${apt.queueNumber ? `
              <span class="appointment-queue-ticket">
                Q-${String(apt.queueNumber).padStart(3, '0')}
              </span>
            ` : ''}
          </div>

        </div>

        <!-- STATUS AND ACTIONS -->
        <div class="appointment-card-right">

          <span class="appointment-status ${statusClass}">
            ${Utils.getStatusBadge(apt.status)}
          </span>

          ${renderAppointmentActions(apt, status)}

        </div>

      </div>

      <!-- SYMPTOMS -->
      <div class="appointment-card-notes">
        <strong>Symptoms / Notes:</strong>
        <span>${escape(apt.reason || 'General checkup')}</span>
      </div>

    </article>
  `;
}

async function loadAppointments() {
  const container = document.getElementById('admin-appointments-list');
  if (!container) return;

  container.innerHTML = `
    <div style="text-align: center; padding: var(--space-8);">
      <div class="spinner" style="margin: 0 auto var(--space-2);"></div>
      <p class="text-xs text-muted">Loading clinic appointments...</p>
    </div>
  `;

  const appointments = await AppointmentService.getAllAppointments();

  if (!Array.isArray(appointments)) {
    container.innerHTML = `
      <div class="empty-state" style="padding: var(--space-8);">
        <h4 class="empty-state-title">Unable to Load Appointments</h4>
        <p class="empty-state-desc">Please try again shortly.</p>
      </div>
    `;
    return;
  }

  // Update status counts using all appointments.
  const counts = {
    all: appointments.length,
    pending: 0,
    approved: 0,
    checkedIn: 0,
    completed: 0
  };

  appointments.forEach(apt => {
    const status = getAppointmentStatus(apt.status);

    if (status === 'Pending') counts.pending++;
    if (status === 'Approved') counts.approved++;
    if (status === 'Checked In') counts.checkedIn++;
    if (status === 'Completed') counts.completed++;
  });

  const countElements = {
    'count-all': counts.all,
    'count-pending': counts.pending,
    'count-approved': counts.approved,
    'count-checked-in': counts.checkedIn,
    'count-completed': counts.completed
  };

  Object.entries(countElements).forEach(([id, count]) => {
    const element = document.getElementById(id);
    if (element) element.textContent = count;
  });

  // Apply status and search filters.
  const filtered = appointments.filter(apt => {
    const status = getAppointmentStatus(apt.status);

    if (activeFilter !== 'all' && status !== activeFilter) {
      return false;
    }

    if (searchQuery) {
      const nameMatch = (apt.studentName || '').toLowerCase().includes(searchQuery);
      const matricMatch = (apt.matricNo || '').toLowerCase().includes(searchQuery);
      const serviceMatch = (apt.serviceName || '').toLowerCase().includes(searchQuery);

      if (!nameMatch && !matricMatch && !serviceMatch) {
        return false;
      }
    }

    return true;
  });

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="padding: var(--space-8);">
        <h4 class="empty-state-title">No Appointments Match</h4>
        <p class="empty-state-desc">
          No records found matching the active filter and search terms.
        </p>
      </div>
    `;
    return;
  }

  // Sort by appointment date first, then appointment time.
  filtered.sort((a, b) => {
    const dateA = getAppointmentDateKey(a.appointmentDate);
    const dateB = getAppointmentDateKey(b.appointmentDate);

    if (dateA !== dateB) {
      return dateA.localeCompare(dateB);
    }

    return getAppointmentTimeValue(a.timeSlot) -
      getAppointmentTimeValue(b.timeSlot);
  });

  // Group appointments by their actual appointment date.
  const groups = new Map();

  filtered.forEach(apt => {
    const dateKey = getAppointmentDateKey(apt.appointmentDate);

    if (!groups.has(dateKey)) {
      groups.set(dateKey, []);
    }

    groups.get(dateKey).push(apt);
  });

  container.innerHTML = Array.from(groups.entries()).map(([date, items]) => `
    <section class="appointment-date-group">

      <div class="appointment-date-heading">
        <h3>${escape(getAppointmentDateLabel(date))}</h3>
        <span>${items.length} ${items.length === 1 ? 'appointment' : 'appointments'}</span>
      </div>

      <div class="appointment-date-cards">
        ${items.map(renderAppointmentCard).join('')}
      </div>

    </section>
  `).join('');
}


// ---------------------------------------------------------------------------
// Clinical Action Handlers
// ---------------------------------------------------------------------------
window.adminApprove = async (id) => {
  const res = await AppointmentService.approveAppointment(id);
  if (res && res.success === false) {
    Toast.error(res.message || 'Unable to approve appointment.');
    return;
  }
  Toast.success('Appointment approved. Patient is now eligible for on-site check-in.');
  await loadAppointments();
  AdminSidebar.render();
};

window.adminComplete = async (id) => {
  Modal.confirm({
    title: 'Complete Appointment',
    message: 'Mark this consultation as completed and finalize the clinical encounter?',
    confirmText: 'Complete Encounter',
    confirmClass: 'btn-teal',
    onConfirm: async () => {
      const res = await AppointmentService.completeAppointment(id);
      if (res && res.success === false) {
        Toast.error(res.message || 'Unable to complete appointment.');
        return false;
      }
      Toast.success('Appointment marked as completed.');
      await loadAppointments();
      AdminSidebar.render();
    }
  });
};

window.adminReject = (id) => {
  Modal.confirm({
    title: 'Reject Appointment Request',
    message: '<label class="form-label" for="rejection-reason">Reason for rejection</label><textarea id="rejection-reason" class="form-control" rows="3" placeholder="Explain why this request cannot be approved"></textarea>',
    confirmText: 'Confirm Rejection',
    confirmClass: 'btn-danger',
    onConfirm: async () => {
      const reason = document.getElementById('rejection-reason').value.trim();
      if (!reason) { Toast.warning('Please enter a reason.'); return false; }
      const result = await AppointmentService.rejectAppointment(id, reason);
      if (!result.success) { Toast.warning(result.message); return false; }
      Toast.warning('Appointment rejected.');
      await loadAppointments();
      AdminSidebar.render();
    }
  });
};

window.adminCheckIn = async (id) => {
  const res = await AppointmentService.checkInPatient(id);
  if (res.success) {
    Toast.success(`Patient ${res.queueItem.patientName} checked in! Queue Ticket ${res.queueNumber} issued.`);
    await loadAppointments();
    AdminSidebar.render();
  } else {
    Toast.error(res.message);
  }
};

window.adminReschedule = async (id, currentDate, currentTime) => {
  const apt = (await AppointmentService.getAllAppointments()).find(a => a.id === id);
  if (!apt) return;
  Modal.confirm({
    title: 'Reschedule Appointment Slot',
    message: `
      <div style="display: flex; flex-direction: column; gap: 12px; text-align: left;">
        <p class="text-xs text-muted">Current Slot: ${Utils.formatDate(currentDate)} at ${currentTime}</p>
        <div class="form-group">
          <label class="form-label">New Consultation Date:</label>
          <input type="date" id="reschedule-date-input" class="form-control" min="${Utils.getTodayDateString()}" value="${currentDate}">
        </div>
        <div class="form-group">
          <label class="form-label">New Time Slot:</label>
          <select id="reschedule-time-input" class="form-control">

          </select>
        </div>
      </div>
    `,
    confirmText: 'Save New Schedule',
    confirmClass: 'btn-teal',
    onConfirm: async () => {
      const newDate = document.getElementById('reschedule-date-input').value;
      const newTime = document.getElementById('reschedule-time-input').value;
      const result = await AppointmentService.rescheduleAppointment(id, newDate, newTime);
      if (!result.success) { Toast.warning(result.message); return false; }
      Toast.success(`Appointment successfully rescheduled to ${Utils.formatDate(newDate)} at ${newTime}`);
      loadAppointments();
    }
  });
  const dateInput = document.getElementById('reschedule-date-input');
  const select = document.getElementById('reschedule-time-input');
  const refresh = () => { const slots = availableSlots(apt.serviceId, apt.doctorId, dateInput.value, id); select.replaceChildren(...(slots.length ? slots.map(s => new Option(s.time, s.time)) : [new Option('No available times', '')])); };
  dateInput.onchange = refresh; refresh();
};

window.adminIssueReferral = async (id) => {
  const studentName = (await AppointmentService.getAllAppointments()).find(a => a.id === id)?.studentName || 'Patient';
  Modal.confirm({
    title: `Issue Clinical Referral - ${studentName}`,
    message: `
      <div style="display: flex; flex-direction: column; gap: 12px; text-align: left;">
        <p class="text-xs text-secondary">Refer patient to specialist hospital units or external university teaching hospital (OAUTHC):</p>
        <div class="form-group">
          <label class="form-label">Referral Unit / Department:</label>
          <select id="referral-dept-select" class="form-control">
            <option value="Diagnostic Laboratory">Diagnostic Laboratory (Blood/Urine/Genotype)</option>
            <option value="Dental Clinic">Dental Surgery Suite</option>
            <option value="Optometry & Eye Clinic">Optometry & Eye Clinic</option>
            <option value="Mental Health & Counselling">Mental Health & Counselling</option>
            <option value="OAUTHC Teaching Hospital">OAUTHC Teaching Hospital (Tertiary Referral)</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Clinical Justification / Referral Notes:</label>
          <textarea id="referral-notes" class="form-control" rows="2" placeholder="State reason for referral..."></textarea>
        </div>
      </div>
    `,
    confirmText: 'Issue Referral Document',
    confirmClass: 'btn-navy',
    onConfirm: () => {
      const dept = document.getElementById('referral-dept-select').value;
      const appointments = Storage.get(APP_CONFIG.STORAGE_KEYS.APPOINTMENTS, []);
      const notes = document.getElementById('referral-notes').value.trim();
      if (!notes) { Toast.warning('Enter the referral notes.'); return false; }
      Storage.set(APP_CONFIG.STORAGE_KEYS.APPOINTMENTS, appointments.map(a => a.id === id ? { ...a, referral: { department: dept, notes, issuedAt: new Date().toISOString() } } : a));
      Toast.success(`Referral to ${dept} issued for ${studentName}.`);
    }
  });
};

window.adminViewDetails = async (id) => {
  const appointments = await AppointmentService.getAllAppointments();
  const apt = appointments.find(item => String(item.id) === String(id));

  if (!apt) return;

  window.currentAdminAppointment = apt;

  const status = getAppointmentStatus(apt.status);
  const statusClass = getStatusClass(status);

  const setText = (elementId, value) => {
    const element = document.getElementById(elementId);
    if (element) element.textContent = value || '--';
  };

  setText('appointment-modal-avatar', getInitials(apt.studentName));
  setText('appointment-modal-name', apt.studentName);
  setText('appointment-modal-matric', apt.matricNo);
  setText('appointment-modal-service', apt.serviceName);
  setText('appointment-modal-doctor', apt.doctorName || 'Medical Officer');
  setText('appointment-modal-date', Utils.formatDate(apt.appointmentDate));
  setText('appointment-modal-time', apt.timeSlot);
  setText('appointment-modal-location', apt.location || 'Consulting Room');
  setText(
    'appointment-modal-queue',
    apt.queueNumber ? `Q-${String(apt.queueNumber).padStart(3, '0')}` : 'Not checked in'
  );
  setText('appointment-modal-symptoms', apt.reason || 'No symptoms or notes provided.');
  setText('appointment-modal-phone', apt.phone || 'Not provided');
  setText('appointment-modal-email', apt.email || 'Not provided');

  // Update the status badge.
  const statusBadge = document.getElementById('appointment-modal-status');

  if (statusBadge) {
    statusBadge.className = `appointment-status ${statusClass}`;
    statusBadge.textContent = status;
  }

  // Update the progress tracker.
  const progressSteps = document.querySelectorAll(
    '#appointment-progress .progress-step'
  );

  const progressOrder = ['Pending', 'Approved', 'Checked In', 'Completed'];
  const currentIndex = progressOrder.indexOf(status);

  progressSteps.forEach((step, index) => {
    step.classList.remove('completed', 'current');

    if (currentIndex >= 0 && index < currentIndex) {
      step.classList.add('completed');
    }

    if (index === currentIndex) {
      step.classList.add('current');
    }
  });

  // Show only actions that apply to the current status.
  const primaryButton = document.getElementById('appointment-modal-primary-action');
  const rescheduleButton = document.getElementById('appointment-modal-reschedule');
  const rejectButton = document.getElementById('appointment-modal-reject');

  if (primaryButton) {
    const actions = {
      'Pending': 'Approve Appointment',
      'Approved': 'Check In Patient',
      'Checked In': 'Complete Appointment'
    };

    primaryButton.textContent = actions[status] || '';
    primaryButton.hidden = !actions[status];
  }

  if (rescheduleButton) {
    rescheduleButton.hidden = !['Pending', 'Approved'].includes(status);
  }

  if (rejectButton) {
    rejectButton.hidden = status !== 'Pending';
  }

  const modal = document.getElementById('appointment-details-modal');

  if (modal) {
    modal.hidden = false;
  }
};
