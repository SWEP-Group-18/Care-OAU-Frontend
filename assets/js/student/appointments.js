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

let activeFilter = 'all';

document.addEventListener('DOMContentLoaded', () => {
  if (!Navigation.requireAuth('student')) return;
  Header.render('My Appointments');
  StudentSidebar.render();

  initStatusTabs();
  loadAppointments();
});

function initStatusTabs() {
  const container = document.getElementById('appointment-status-tabs');
  if (!container) return;

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

  const appointments = await AppointmentService.getStudentAppointments(Storage.get(APP_CONFIG.STORAGE_KEYS.AUTH_USER)?.id);
  const filtered = appointments.filter(a => activeFilter === 'all' ? !['Completed','Cancelled','Rejected','No Show'].includes(a.status) : activeFilter === 'Cancelled' ? ['Cancelled','Rejected','No Show'].includes(a.status) : a.status === activeFilter);
  if (!filtered.length) { tbody.innerHTML = '<div class="quiet-card"><h3>No appointments here yet</h3><p>Your visits will appear here once you book an appointment.</p><a href="book-appointment.html" class="btn btn-teal">Book Appointment</a></div>'; return; }
  tbody.innerHTML = filtered.map(apt => {
    const date = new Date(apt.appointmentDate + 'T12:00:00');
    const canCancel = ['Pending Approval', 'Approved'].includes(apt.status);
    return `<article class="appointment-list-card">
      <div class="appointment-list-top"><div>${Utils.getStatusBadge(apt.status)}<h2>${Utils.escapeHtml(apt.serviceName)}</h2><p>Booking reference  -  ${Utils.escapeHtml(apt.referenceNo || apt.id)}</p></div>
      <div class="large-date"><strong>${date.getDate()}</strong><span>${date.toLocaleDateString('en-GB',{month:'short',year:'numeric'})}<br>${date.toLocaleDateString('en-GB',{weekday:'long'})}</span></div></div>
      <div class="appointment-info-grid"><div><span>Scheduled time</span><strong>${Utils.escapeHtml(apt.timeSlot)}</strong></div><div><span>Doctor</span><strong>${Utils.escapeHtml(apt.doctorName)}</strong></div><div><span>Location</span><strong>Care-OAU Health Centre</strong></div></div>
      ${apt.status === 'Pending Approval' ? '<p class="status-message">Your request is awaiting staff review. Your queue number will be issued at reception after approval.</p>' : ''}
      ${apt.rejectionReason ? '<p class="status-message">' + Utils.escapeHtml(apt.rejectionReason) + '</p>' : ''}
      <div class="appointment-list-actions"><button class="btn btn-outline-navy" onclick="viewAppointmentDetails('${apt.id}')">View details</button>
      ${apt.queueNumber ? '<a href="queue-tracking.html" class="btn btn-teal">Track Queue</a>' : ''}
      ${canCancel ? '<button class="btn btn-ghost text-danger" onclick="cancelAppointmentRequest(\'' + apt.id + '\')">Cancel appointment</button>' : ''}</div></article>`;
  }).join('');
}

// Global cancellation handler
window.cancelAppointmentRequest = (appointmentId) => {
  Modal.confirm({
    title: 'Cancel Appointment Request?',
    message: 'Are you sure you want to cancel this appointment request? This action cannot be reversed.',
    confirmText: 'Yes, Cancel Appointment',
    confirmClass: 'btn-danger',
    onConfirm: async () => {
      await AppointmentService.cancelAppointment(appointmentId, 'Cancelled by student request.');
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
