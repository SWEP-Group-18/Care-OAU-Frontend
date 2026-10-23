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

let activeFilter = 'all';
let searchQuery = '';

document.addEventListener('DOMContentLoaded', () => {
  if (!Navigation.requireAuth('admin')) return;
  Header.render('Appointment Management & Check-in');
  AdminSidebar.render();

  initControls();
  loadAppointments();
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
}

async function loadAppointments() {
  const tbody = document.getElementById('admin-appointments-tbody');
  if (!tbody) return;

  tbody.innerHTML = `
    <tr>
      <td colspan="7" style="text-align: center; padding: var(--space-8);">
        <div class="spinner" style="margin: 0 auto var(--space-2);"></div>
        <p class="text-xs text-muted">Loading clinic appointments...</p>
      </td>
    </tr>
  `;

  const appointments = await AppointmentService.getAllAppointments();

  const filtered = appointments.filter(apt => {
    // Status filter
    if (activeFilter !== 'all' && apt.status !== activeFilter) {
      return false;
    }

    // Search query
    if (searchQuery) {
      const nameMatch = (apt.studentName || '').toLowerCase().includes(searchQuery);
      const matricMatch = (apt.matricNo || '').toLowerCase().includes(searchQuery);
      const serviceMatch = (apt.serviceName || '').toLowerCase().includes(searchQuery);
      if (!nameMatch && !matricMatch && !serviceMatch) return false;
    }

    return true;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7">
          <div class="empty-state" style="padding: var(--space-8);">
            <h4 class="empty-state-title">No Appointments Match</h4>
            <p class="empty-state-desc">No records found matching the active filter and search terms.</p>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = filtered.map(apt => {
    const isPending = apt.status === APP_CONFIG.APPOINTMENT_STATUS.PENDING;
    const isApproved = apt.status === APP_CONFIG.APPOINTMENT_STATUS.APPROVED;
    const isCheckedIn = apt.status === APP_CONFIG.APPOINTMENT_STATUS.CHECKED_IN;

    return `
      <tr>
        <td>
          <div class="text-sm text-bold text-navy">${Utils.escapeHtml(apt.studentName)}</div>
          <div class="text-xs text-teal">${Utils.escapeHtml(apt.matricNo)}</div>
          <div class="text-xs text-muted">${apt.phone || ''}</div>
        </td>
        <td>
          <div class="text-sm text-semibold">${Utils.escapeHtml(apt.serviceName)}</div>
          <div class="text-xs text-muted">${apt.doctorName || 'Medical Officer'}</div>
        </td>
        <td>
          <div class="text-sm">${Utils.formatDate(apt.appointmentDate)}</div>
          <div class="text-xs text-muted">${apt.timeSlot}</div>
        </td>
        <td style="max-width: 180px;">
          <div class="text-xs text-secondary" style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${Utils.escapeHtml(apt.reason)}">
            ${Utils.escapeHtml(apt.reason || 'General checkup')}
          </div>
        </td>
        <td>
          ${Utils.getStatusBadge(apt.status)}
        </td>
        <td>
          ${apt.referral ? '<div class="text-sm"><strong>Referral: ' + Utils.escapeHtml(apt.referral.department) + '</strong><p>' + Utils.escapeHtml(apt.referral.notes) + '</p></div>' : ''}
        ${apt.queueNumber ? `
            <span class="badge badge-teal" style="font-weight: 700; font-size: 13px;">${apt.queueNumber}</span>
          ` : `
            <span class="text-xs text-muted">&mdash;</span>
          `}
        </td>
        <td style="text-align: right;">
          <div style="display: inline-flex; gap: 6px; align-items: center; flex-wrap: wrap; justify-content: flex-end;">
            
            ${isPending ? `
              <button type="button" class="btn btn-teal btn-sm" onclick="window.adminApprove('${apt.id}')">
                Approve
              </button>
              <button type="button" class="btn btn-outline-danger btn-sm" onclick="window.adminReject('${apt.id}')">
                Reject
              </button>
              <button type="button" class="btn btn-ghost btn-sm" onclick="window.adminReschedule('${apt.id}', '${apt.appointmentDate}', '${apt.timeSlot}')">
                Reschedule
              </button>
            ` : ''}

            ${isApproved ? `
              <button type="button" class="btn btn-teal btn-sm" onclick="window.adminCheckIn('${apt.id}')">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
                  <circle cx="9" cy="7" r="4"/>
                  <polyline points="16 11 18 13 22 9"/>
                </svg>
                Check In Patient
              </button>
              <button type="button" class="btn btn-outline-navy btn-sm" onclick="window.adminIssueReferral('${apt.id}')">
                Refer
              </button>
            ` : ''}

            ${isCheckedIn ? `
              <a href="queue-management.html" class="btn btn-outline-teal btn-sm">
                Queue (${apt.queueNumber})
              </a>
            ` : ''}

            <button type="button" class="btn btn-ghost btn-sm" onclick="window.adminViewDetails('${apt.id}')">
              Details
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

// ---------------------------------------------------------------------------
// Clinical Action Handlers
// ---------------------------------------------------------------------------
window.adminApprove = async (id) => {
  await AppointmentService.approveAppointment(id);
  Toast.success('Appointment approved. Patient is now eligible for on-site check-in.');
  loadAppointments();
  AdminSidebar.render();
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
      loadAppointments();
      AdminSidebar.render();
    }
  });
};

window.adminCheckIn = async (id) => {
  const res = await AppointmentService.checkInPatient(id);
  if (res.success) {
    Toast.success(`Patient ${res.queueItem.patientName} checked in! Queue Ticket ${res.queueNumber} issued.`);
    loadAppointments();
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
  const apt = appointments.find(a => a.id === id);
  if (!apt) return;

  Modal.confirm({
    title: `Medical Record - ${Utils.escapeHtml(apt.matricNo)}`,
    message: `
      <div style="display: flex; flex-direction: column; gap: 10px; text-align: left;">
        <div style="display: flex; justify-content: space-between;">
          <span class="text-xs text-muted">Status:</span>
          <div>${Utils.getStatusBadge(apt.status)}</div>
        </div>
        <div>
          <span class="text-xs text-muted">Patient:</span>
          <div class="text-sm text-bold text-navy">${Utils.escapeHtml(apt.studentName)} (${Utils.escapeHtml(apt.matricNo)})</div>
        </div>
        <div>
          <span class="text-xs text-muted">Phone:</span>
          <div class="text-xs">${apt.phone || 'N/A'}</div>
        </div>
        <div>
          <span class="text-xs text-muted">Service & Assigned Doctor:</span>
          <div class="text-xs text-secondary">${Utils.escapeHtml(apt.serviceName)} &bull; ${apt.doctorName || 'Any'}</div>
        </div>
        <div>
          <span class="text-xs text-muted">Symptoms / Triage Notes:</span>
          <div class="text-xs text-navy" style="background: #F8FAFC; padding: 8px; border-radius: 6px; margin-top: 4px;">
            ${Utils.escapeHtml(apt.reason || 'None provided')}
          </div>
        </div>
        ${apt.queueNumber ? `
          <div style="background: var(--color-mint); padding: 8px; border-radius: 6px; text-align: center;">
            <span class="text-xs text-teal">Queue Ticket:</span>
            <div style="font-size: 20px; font-weight: 800; color: var(--color-teal);">${apt.queueNumber}</div>
          </div>
        ` : ''}
      </div>
    `,
    confirmText: 'Done',
    confirmClass: 'btn-teal',
    cancelText: 'Close'
  });
};
