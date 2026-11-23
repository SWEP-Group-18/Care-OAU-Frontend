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
import { socket } from '../core/socket.js';

let activeFilter = 'all';
const recentlyUpdatedAppointments = new Set();

function getAppointmentStatusKey(status = '') {
    return status
        .toLowerCase()
        .replace(/\s+/g, '_')
        .replace('pending_approval', 'pending');
}

function getAppointmentStatusTimestamp(appointment) {
    const timestamp = appointment.updatedAt || appointment.createdAt;
    return timestamp ? new Date(timestamp).getTime() || 0 : 0;
}

function getAppointmentStatusClass(status) {
    const statusKey = getAppointmentStatusKey(status);

    const allowedStatuses = [
        'pending',
        'approved',
        'rejected',
        'cancelled',
        'checked_in',
        'in_consultation',
        'completed',
        'no_show'
    ];

    return allowedStatuses.includes(statusKey)
        ? `appointment-status-${statusKey}`
        : 'appointment-status-default';
}

function handleAppointmentUpdated(data) {
    const appointment = data?.appointment;

    if (!appointment) return;

    recentlyUpdatedAppointments.add(appointment.publicId);

    const status = getAppointmentStatusKey(appointment.status);

    switch (status) {
        case 'approved':
            Toast.success('Your appointment has been approved!');
            break;

        case 'rejected':
            Toast.info('Unfortunately, your appointment has been rejected. Please review the rejection reason.');
            break;

        case 'cancelled':
            Toast.info('Your appointment has been cancelled.');
            break;

        case 'checked_in': {
          const queueNumber = appointment.queue?.queueNumber || appointment.queueNumber;

          const queueTicket = queueNumber
              ? `Q-${String(queueNumber).padStart(3, '0')}`
              : null;

          Toast.success(
              queueTicket
                  ? `Your appointment has been checked in! Your queue ticket is ${queueTicket}. Please wait for your turn.`
                  : 'Your appointment has been checked in successfully!'
          );
          break;
        }

        case 'completed':
            Toast.success('Your appointment has been completed!');
            break;
    }

    loadAppointments();
}

document.addEventListener('DOMContentLoaded', () => {
  if (!Navigation.requireAuth('student')) return;

  Header.render('My Appointments');
  StudentSidebar.render();

  initStatusTabs();
  loadAppointments();

  socket.on('appointment:updated', handleAppointmentUpdated);

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
    appointments.sort((a, b) =>
        getAppointmentStatusTimestamp(b) - getAppointmentStatusTimestamp(a)
    );

    const filtered = appointments.filter(apt => {
      switch (activeFilter) {
        case 'pending':
            return ['Pending', 'Pending Approval'].includes(apt.status);

        case 'approved':
            return apt.status === 'Approved';

        case 'in_progress':
            return ['Checked In', 'In Consultation'].includes(apt.status);

        case 'history':
            return ['Completed', 'Rejected', 'Cancelled', 'No Show'].includes(apt.status);

        case 'all':
        default:
            return true;
      }
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
      const hasBeenUpdated = recentlyUpdatedAppointments.has(apt.publicId);
      
      const statusClass = hasBeenUpdated
          ? getAppointmentStatusClass(apt.status)
          : '';

      return `<article class="appointment-list-card ${statusClass}">
        <div class="appointment-list-top">
          <div>
              <div class="appointment-status-group">
                  ${Utils.getStatusBadge(apt.status)}
                  ${apt.queueNumber ? `
                      <span class="appointment-queue-ticket">
                          Q-${String(apt.queueNumber).padStart(3, '0')}
                      </span>
                  ` : ''}
              </div>
              <h2>${Utils.escapeHtml(apt.serviceName || 'General Medical Consultation')}</h2>
              <p>Booking reference  -  ${Utils.escapeHtml(displayId)}</p>
        </div>
        <div class="large-date"><strong>${date.getDate()}</strong><span>${date.toLocaleDateString('en-GB',{month:'short',year:'numeric'})}<br>${date.toLocaleDateString('en-GB',{weekday:'long'})}</span></div></div>
        <div class="appointment-info-grid"><div><span>Scheduled time</span><strong>${Utils.escapeHtml(apt.timeSlot || '08:00 AM')}</strong></div><div><span>Doctor</span><strong>${Utils.escapeHtml(apt.doctorName || 'Assigned Physician')}</strong></div><div><span>Location</span><strong>${Utils.escapeHtml(apt.location || 'Care-OAU Health Centre')}</strong></div></div>
        ${apt.reason ? `
          <div class="appointment-notes">
              <p>
                  <strong>Symptoms / Notes:</strong>
                  <span>${Utils.escapeHtml(apt.reason)}</span>
              </p>
          </div>
        ` : ''}

        ${apt.status === 'Rejected' && apt.rejectionReason ? `
          <div class="appointment-rejection-notice">
              <p>
                  <strong>Rejection Notice:</strong>
                  <span>${Utils.escapeHtml(apt.rejectionReason)}</span>
              </p>
          </div>
        ` : ''}

        ${apt.status === 'Cancelled' && apt.cancellationReason ? `
          <div class="appointment-cancellation-notice">
              <p>
                  <strong>Cancellation Notice:</strong>
                  <span>${Utils.escapeHtml(apt.cancellationReason)}</span>
              </p>
          </div>
      ` : ''}
        
        <div class="appointment-list-actions">
            <button class="btn btn-outline-navy" onclick="viewAppointmentDetails('${apt.id}')">View details</button>

            ${apt.queueNumber ? '<a href="queue-tracking.html" class="btn btn-teal">Track Queue</a>' : ''}

            ${canCancel ? '<button class="btn btn-ghost text-danger" onclick="cancelAppointmentRequest(\'' + apt.id + '\')">Cancel appointment</button>' : ''}
        </div>
        </article>`;

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
    message: `
      <div style="display: flex; flex-direction: column; gap: 10px; text-align: left;">
        <p class="text-xs text-secondary">
          Are you sure you want to cancel this appointment? This action cannot be reversed.
        </p>

        <div class="form-group">
          <label class="form-label" for="cancellation-reason">
              Reason for cancellation
          </label>
          <textarea
              id="cancellation-reason"
              class="form-control"
              rows="3"
              placeholder="Please explain why you want to cancel this appointment..."
          ></textarea>
        </div>
      </div>
    `,
    confirmText: 'Confirm Cancellation',
    confirmClass: 'btn-danger',
    onConfirm: async () => {
      const reasonInput = document.getElementById('cancellation-reason');
      const reason = reasonInput?.value.trim();

      if (!reason) {
        Toast.warning('Please enter a cancellation reason.');
        return false;
      }

      const res = await AppointmentService.cancelAppointment(
        appointmentId,
        reason
      );

      if (res && res.success === false) {
        Toast.error(res.message || 'Unable to cancel appointment.');
        return false;
      }

      Toast.success('Appointment cancelled successfully.');

      await loadAppointments();
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
            <div style="font-size: 24px; font-weight: 800; color: var(--color-teal);">Q-${String(apt.queueNumber).padStart(3, '0')}</div>
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
