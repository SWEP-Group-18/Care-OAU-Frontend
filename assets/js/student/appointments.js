import { Storage } from '../core/storage.js';
import { Navigation } from '../core/navigation.js';
/**
 * Care-OAU - Student Appointments Page Logic
 * Manages appointments list, status filtering, cancellations, and queue navigation.
 */

import { AppointmentService } from '../services/appointment-service.js';
import { StudentSidebar } from '../components/student-sidebar.js';
import { Header } from '../components/header.js';
import { Modal } from '../components/modal.js';
import { Toast } from '../components/toast.js';
import { Utils } from '../core/utils.js';
import { APP_CONFIG } from '../core/config.js';
import { SyncManager } from '../core/sync-manager.js';

let activeFilter = 'upcoming';
let appointmentsPoller = null;

document.addEventListener('DOMContentLoaded', () => {
  if (!Navigation.requireAuth('student')) return;
  Header.render('My Appointments');
  StudentSidebar.render();

  initStatusTabs();
  loadAppointments();

  appointmentsPoller = SyncManager.createPoller({
    name: 'student-appointments-sync',
    interval: 8000,
    fetchFn: () => loadAppointments(),
    immediate: false
  });
  appointmentsPoller.start();
});

function initStatusTabs() {
  const container = document.getElementById('appointment-status-tabs');
  if (!container) return;

  const urlTab = new URLSearchParams(window.location.search).get('tab');
  if (urlTab) {
    const matchingBtn = container.querySelector(`[data-filter="${urlTab}"]`);
    if (matchingBtn) {
      container.querySelectorAll('.tab-filter-btn').forEach(b => b.classList.remove('active'));
      matchingBtn.classList.add('active');
      activeFilter = urlTab;
    }
  }

  container.querySelectorAll('.tab-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('.tab-filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeFilter = btn.dataset.filter;
      loadAppointments();
    });
  });
}

async function loadAppointments() {
  const tbody = document.getElementById('appointments-tbody');
  if (!tbody) return;

  try {
    const user = Storage.get(APP_CONFIG.STORAGE_KEYS.AUTH_USER);
    const appointments = await AppointmentService.getStudentAppointments(user?.id);
    const filtered = appointments.filter(a => {
      if (activeFilter === 'all') return true;
      if (activeFilter === 'upcoming') {
        return ['Pending', 'Pending Approval', 'Approved', 'Checked In', 'In Consultation'].includes(a.status) ||
          !['Completed', 'Cancelled', 'Rejected', 'No Show'].includes(a.status);
      }
      if (activeFilter === 'history') {
        return ['Completed', 'Cancelled', 'Rejected', 'No Show'].includes(a.status);
      }
      return a.status === activeFilter;
    });

    if (!filtered.length) {
      const hasHistory = appointments.some(a => ['Completed', 'Cancelled', 'Rejected', 'No Show'].includes(a.status));
      if (activeFilter === 'upcoming') {
        tbody.innerHTML = `
          <div class="quiet-card">
            <h3>No upcoming appointments</h3>
            <p>You have no pending or scheduled appointments right now.</p>
            <div style="display: flex; gap: 10px; justify-content: center; flex-wrap: wrap; margin-top: 14px;">
              <a href="book-appointment.html" class="btn btn-teal">Book Appointment</a>
              ${hasHistory ? '<button type="button" class="btn btn-outline-navy" onclick="document.querySelector(\'[data-filter=\\\'history\\\']\').click()">View History</button>' : ''}
            </div>
          </div>
        `;
      } else if (activeFilter === 'history') {
        tbody.innerHTML = `
          <div class="quiet-card">
            <h3>No past appointment history</h3>
            <p>Completed, cancelled, or past consultation records will appear here.</p>
            <a href="book-appointment.html" class="btn btn-teal">Book Appointment</a>
          </div>
        `;
      } else {
        tbody.innerHTML = `
          <div class="quiet-card">
            <h3>No appointments here yet</h3>
            <p>Your visits will appear here once you book an appointment.</p>
            <a href="book-appointment.html" class="btn btn-teal">Book Appointment</a>
          </div>
        `;
      }
      return;
    }

    tbody.innerHTML = filtered.map(apt => {
      const rawDate = apt.appointmentDate || apt.date;
      const date = rawDate ? new Date(rawDate.includes('T') ? rawDate : rawDate + 'T12:00:00') : new Date();
      const isPendingStatus = apt.status === 'Pending' || apt.status === 'Pending Approval';
      const canCancel = isPendingStatus || apt.status === 'Approved';
      const displayId = apt.referenceNo || apt.publicId || apt.id;
      return `<article class="appointment-list-card">
        <div class="appointment-list-top"><div>${Utils.getStatusBadge(apt.status)}<h2>${Utils.escapeHtml(apt.serviceName || 'General Medical Consultation')}</h2><p>Booking reference  -  ${Utils.escapeHtml(displayId)}</p></div>
        <div class="large-date"><strong>${date.getDate()}</strong><span>${date.toLocaleDateString('en-GB',{month:'short',year:'numeric'})}<br>${date.toLocaleDateString('en-GB',{weekday:'long'})}</span></div></div>
        <div class="appointment-info-grid"><div><span>Scheduled time</span><strong>${Utils.escapeHtml(apt.timeSlot || '08:00 AM')}</strong></div><div><span>Doctor</span><strong>${Utils.escapeHtml(apt.doctorName || 'Assigned Physician')}</strong></div><div><span>Location</span><strong>${Utils.escapeHtml(apt.location || 'Care-OAU Health Centre')}</strong></div></div>
        ${isPendingStatus ? '<p class="status-message">Your request is awaiting staff review. Your queue number will be issued at reception after approval.</p>' : ''}
        ${apt.status === 'Approved' ? '<p class="status-message text-teal"><strong>Approved:</strong> Your visit is confirmed. Please arrive 10 minutes prior to scheduled time for reception check-in.</p>' : ''}
        ${apt.rejectionReason ? '<p class="status-message text-danger"><strong>Reason:</strong> ' + Utils.escapeHtml(apt.rejectionReason) + '</p>' : ''}
        ${apt.cancellationReason ? '<p class="status-message text-muted"><strong>Cancellation notice:</strong> ' + Utils.escapeHtml(apt.cancellationReason) + '</p>' : ''}
        <div class="appointment-list-actions">
          <button class="btn btn-outline-navy" onclick="viewAppointmentDetails('${apt.id}')">View details</button>
          ${apt.status === 'Approved' ? `
            <button type="button" class="btn btn-teal" onclick="window.studentCheckIn('${apt.id}')">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <polyline points="16 11 18 13 22 9"/>
              </svg>
              Confirm Arrival & Check In
            </button>
          ` : ''}
          ${apt.queueNumber ? '<a href="queue-tracking.html" class="btn btn-teal">Track Queue</a>' : ''}
          ${canCancel ? '<button class="btn btn-ghost text-danger" onclick="cancelAppointmentRequest(\'' + apt.id + '\')">Cancel appointment</button>' : ''}
        </div></article>`;
    }).join('');
  } catch (err) {
    console.error('[Appointments] Error loading appointments:', err);
    tbody.innerHTML = '<div class="quiet-card"><h3>Unable to load appointments</h3><p>Please check your connection and try again.</p><button type="button" class="btn btn-outline-teal" onclick="location.reload()">Retry</button></div>';
  }
}

// Global cancellation handler
window.cancelAppointmentRequest = (appointmentId) => {
  Modal.confirm({
    title: 'Cancel Appointment Request?',
    message: 'Are you sure you want to cancel this appointment request? This action cannot be reversed.',
    confirmText: 'Yes, Cancel Appointment',
    confirmClass: 'btn-danger',
    onConfirm: async () => {
      const res = await AppointmentService.cancelAppointment(appointmentId, 'Cancelled by student request.');
      if (res && res.success === false) {
        Toast.error(res.message || 'Unable to cancel appointment.');
        return;
      }
      Toast.success('Appointment cancelled successfully.');
      loadAppointments();
      StudentSidebar.render();
    }
  });
};

// Global details modal
window.viewAppointmentDetails = async (appointmentId) => {
  const appointments = await AppointmentService.getStudentAppointments(Storage.get(APP_CONFIG.STORAGE_KEYS.AUTH_USER)?.id);
  const apt = appointments.find(a => a.id === appointmentId);
  if (!apt) return;

  Modal.confirm({
    title: `Appointment Details - ${apt.id}`,
    message: `
      <div style="display: flex; flex-direction: column; gap: 12px; text-align: left;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span class="text-xs text-muted">Current Status:</span>
          <div>${Utils.getStatusBadge(apt.status)}</div>
        </div>
        <div>
          <span class="text-xs text-muted">Medical Service:</span>
          <div class="text-sm text-bold text-navy">${apt.serviceName}</div>
        </div>
        <div>
          <span class="text-xs text-muted">Assigned Doctor:</span>
          <div class="text-sm text-bold text-navy">${apt.doctorName || 'Health Centre Medical Team'}</div>
        </div>
        <div>
          <span class="text-xs text-muted">Scheduled Date & Slot:</span>
          <div class="text-sm text-navy">${Utils.formatDate(apt.appointmentDate)} at ${apt.timeSlot}</div>
        </div>
        <div>
          <span class="text-xs text-muted">Patient Reason / Symptoms:</span>
          <div class="text-xs text-secondary" style="background: #F8FAFC; padding: 8px 12px; border-radius: 6px; margin-top: 4px;">
            ${Utils.escapeHtml(apt.reason || 'No description provided')}
          </div>
        </div>
        ${apt.queueNumber ? `
          <div style="background: var(--color-mint); padding: 8px 12px; border-radius: 6px; text-align: center;">
            <span class="text-xs text-teal">Assigned Queue Ticket:</span>
            <div style="font-size: 24px; font-weight: 800; color: var(--color-teal);">${apt.queueNumber}</div>
          </div>
        ` : `
          <div class="text-xs text-muted" style="border-top: 1px solid var(--color-divider); padding-top: 8px;">
            <strong>Check-in Policy:</strong> Queue numbers are generated only after physical check-in at the Health Centre reception.
          </div>
        `}
      </div>
    `,
    confirmText: 'Close Details',
    confirmClass: 'btn-teal',
    cancelText: 'Dismiss'
  });
};

window.addEventListener('storage', event => { if (event.key?.startsWith('care_oau_')) loadAppointments(); });

// Global student check-in handler from appointments list
window.studentCheckIn = (appointmentId) => {
  Modal.confirm({
    title: 'Confirm Clinic Arrival & Check In',
    message: 'Are you currently at the Care-OAU Health Centre? Confirming arrival will check you in and issue your sequential live queue ticket.',
    confirmText: 'Yes, Check In Now',
    confirmClass: 'btn-teal',
    cancelText: 'Not Yet',
    onConfirm: async () => {
      const res = await AppointmentService.checkInPatient(appointmentId);
      if (res && res.success === false) {
        Toast.warning(res.message || 'Unable to check in at this time.');
        return false;
      }
      Toast.success(`Check-in successful! Assigned Queue Ticket: ${res.queueNumber || ''}`);
      await loadAppointments();
      StudentSidebar.render();
      setTimeout(() => {
        window.location.href = 'queue-tracking.html';
      }, 1200);
    }
  });
};
