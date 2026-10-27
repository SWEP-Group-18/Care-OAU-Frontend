import { Navigation } from '../core/navigation.js';
/**
 * Care-OAU - Student Queue Tracking Logic
 * Renders real-time queue ticket monitor, position ahead, currently serving,
 * and hospital check-in demo triggers.
 */

import { QueueService } from '../services/queue-service.js';
import { AppointmentService } from '../services/appointment-service.js';
import { StudentSidebar } from '../components/student-sidebar.js';
import { Header } from '../components/header.js';
import { Storage } from '../core/storage.js';
import { APP_CONFIG } from '../core/config.js';
import { Toast } from '../components/toast.js';
import { SyncManager } from '../core/sync-manager.js';

let queuePoller = null;

document.addEventListener('DOMContentLoaded', () => {
  if (!Navigation.requireAuth('student')) return;
  Header.render('Real-time Queue Tracking');
  StudentSidebar.render();

  loadQueueTracker();

  queuePoller = SyncManager.createPoller({
    name: 'student-queue-tracker',
    interval: 10000,
    fetchFn: () => loadQueueTracker(),
    immediate: false
  });
  queuePoller.start();

  const refreshBtn = document.getElementById('btn-refresh-queue');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      Toast.info('Refreshing live queue position...');
      if (queuePoller) {
        queuePoller.trigger();
      } else {
        loadQueueTracker();
      }
    });
  }
});

async function loadQueueTracker() {
  const container = document.getElementById('queue-display-container');
  if (!container) return;

  const user = Storage.get(APP_CONFIG.STORAGE_KEYS.AUTH_USER) || {
    name: 'Oluwaseun Adeleke',
    matricNo: 'CSC/2021/045'
  };

  const activeTicket = await QueueService.getStudentActiveTicket(user.matricNo);
  const currentlyServing = await QueueService.getCurrentlyServing();

  if (!activeTicket) {
    const history = await QueueService.getQueue();
    const latest = [...history].reverse().find(q => q.matricNo === user.matricNo);
    if (latest && ['Completed', 'No Show'].includes(latest.status)) {
      container.innerHTML = `<section class="queue-simple"><span class="badge badge-info">${latest.status}</span><h2 style="margin:18px 0">${latest.status === 'Completed' ? 'Your visit is complete' : 'You missed your call'}</h2><p>${latest.status === 'Completed' ? 'Thank you for visiting the health centre. Your appointment history has been updated.' : 'Please speak with reception to arrange your next consultation.'}</p><a href="my-appointments.html" class="btn btn-teal" style="margin-top:20px">View appointments</a></section>`;
      return;
    }
    // Check if student has an approved appointment ready for check-in
    const appointments = await AppointmentService.getStudentAppointments(user.id);
    const approvedApt = appointments.find(a => a.status === APP_CONFIG.APPOINTMENT_STATUS.APPROVED);

    container.innerHTML = `
      <div class="card" style="padding: var(--space-8); text-align: center;">
        <div class="empty-state-icon" style="margin: 0 auto var(--space-4);">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <polyline points="12 6 12 12 16 14"/>
          </svg>
        </div>
        <h3 class="h3 text-navy" style="margin-bottom: var(--space-2);">No Active Queue Ticket</h3>
        <p class="text-sm text-muted" style="max-width: 520px; margin: 0 auto var(--space-6);">
          You do not currently have an active hospital check-in. In accordance with Health Centre guidelines, queue tickets are issued only after staff check-in at the clinic reception.
        </p>

        <div class="card" style="max-width: 560px; margin: 0 auto var(--space-6); background: var(--color-mint); border-color: var(--color-mint-dark); text-align: left;">
          <div class="card-body" style="padding: var(--space-4);">
            <div class="text-xs" style="color: var(--color-teal-hover); line-height: 1.5;">
              <strong>Check-in Requirement:</strong> 
              ${approvedApt ? 
                `You have an <strong>Approved</strong> appointment for <strong>${approvedApt.serviceName}</strong>. You can simulate on-site arrival check-in below to test queue tracking.` : 
                `Book an appointment and await clinical approval. Once approved, present your matric card at reception for check-in.`
              }
            </div>
          </div>
        </div>

        <div style="display: flex; gap: var(--space-3); justify-content: center; flex-wrap: wrap;">
          ${approvedApt ? `
            <button type="button" class="btn btn-teal" onclick="window.demoSelfCheckIn('${approvedApt.id}')">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <polyline points="16 11 18 13 22 9"/>
              </svg>
              Simulate Reception Check-in (Demo)
            </button>
          ` : `
            <a href="book-appointment.html" class="btn btn-teal">Book New Appointment</a>
          `}
          <a href="my-appointments.html" class="btn btn-outline-navy">View Appointments</a>
        </div>
      </div>
    `;
    return;
  }

  // Active Ticket Found!
  const patientsAhead = await QueueService.getPatientsAhead(activeTicket.queueNumber);
  const estimatedMins = Math.max(5, patientsAhead * 10);

  let statusDescription = 'Waiting in reception area for your turn';
  if (activeTicket.status === APP_CONFIG.QUEUE_STATUS.CALLED) {
    statusDescription = `Please proceed immediately to ${activeTicket.room || 'Consulting Room 2'}`;
  } else if (activeTicket.status === APP_CONFIG.QUEUE_STATUS.IN_CONSULTATION) {
    statusDescription = 'Consultation with physician in progress';
  }

  container.innerHTML = `<section class="queue-simple" aria-live="polite">
    <div class="live-update"><span class="live-dot"></span> Live queue  -  Updated ${new Date().toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})}</div>
    <h2>${activeTicket.status === 'Waiting' ? 'You are in the queue' : activeTicket.status}</h2>
    <div class="people-ahead"><strong>${activeTicket.status === 'Waiting' ? patientsAhead : 0}</strong><span>people ahead of you</span></div>
    <div class="queue-simple-details"><div><span>Your queue number</span><strong>${activeTicket.queueNumber}</strong></div><div><span>Estimated wait</span><strong>${activeTicket.status === 'Waiting' ? '~' + estimatedMins + ' mins' : 'Your turn'}</strong></div><div><span>Consulting room</span><strong>${activeTicket.room || 'Reception'}</strong></div></div>
    <p>${statusDescription}</p><p class="text-xs text-muted" style="margin-top:12px">Wait times are estimates. Emergency cases may be prioritised by clinical staff.</p>
  </section>`;
}

// Global Demo trigger to simulate on-site receptionist check-in
window.demoSelfCheckIn = async (appointmentId) => {
  const res = await AppointmentService.checkInPatient(appointmentId);
  if (res.success) {
    Toast.success(`Check-in successful! Queue Ticket ${res.queueNumber} assigned.`);
    loadQueueTracker();
    StudentSidebar.render();
  } else {
    Toast.error(res.message);
  }
};

window.addEventListener('storage', event => { if (event.key?.startsWith('care_oau_')) loadQueueTracker(); });
