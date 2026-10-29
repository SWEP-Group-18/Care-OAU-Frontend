import { Utils } from '../core/utils.js';
import { availableSlots, localDate } from '../services/availability.js';
import { AppointmentService } from '../services/appointment-service.js';
import { Navigation } from '../core/navigation.js';
/**
 * OAU Health Care - Student Dashboard Logic (Figma Aligned)
 * Handles welcome banner, availability stats, upcoming appointment card, and queue state.
 */

import { Storage } from '../core/storage.js';
import { APP_CONFIG } from '../core/config.js';
import { StudentSidebar } from '../components/student-sidebar.js';
import { Header } from '../components/header.js';
import { DoctorService } from '../services/doctor-service.js';
import { INITIAL_APPOINTMENTS, INITIAL_SERVICES, INITIAL_QUEUE } from '../data/mock-data.js';
import { SyncManager } from '../core/sync-manager.js';

let dashboardPoller = null;

document.addEventListener('DOMContentLoaded', () => {
  if (!Navigation.requireAuth('student')) return;
  DoctorService.purgeLegacyDemoDoctors();
  let user = Storage.get(APP_CONFIG.STORAGE_KEYS.AUTH_USER);
  if (!user) {
    if (APP_CONFIG.USE_MOCK_DATA) {
      user = {
        id: 'usr_student_01',
        name: 'Amina Yusuf',
        matricNo: '21/SCI/1048',
        email: 'amina@university.edu',
        phone: '+234 800 000 0000',
        role: 'student',
        isVerified: true
      };
      Storage.set(APP_CONFIG.STORAGE_KEYS.AUTH_USER, user);
    } else {
      window.location.href = '../student/auth.html';
      return;
    }
  }

  // Seed storage only in isolated mock/test mode
  if (APP_CONFIG.USE_MOCK_DATA) {
    if (!Storage.get(APP_CONFIG.STORAGE_KEYS.APPOINTMENTS)) {
      Storage.set(APP_CONFIG.STORAGE_KEYS.APPOINTMENTS, INITIAL_APPOINTMENTS);
    }
    if (!Storage.get(APP_CONFIG.STORAGE_KEYS.SERVICES)) {
      Storage.set(APP_CONFIG.STORAGE_KEYS.SERVICES, INITIAL_SERVICES);
    }
    if (!Storage.get(APP_CONFIG.STORAGE_KEYS.QUEUE)) {
      Storage.set(APP_CONFIG.STORAGE_KEYS.QUEUE, INITIAL_QUEUE);
    }
  }

  // Render navigation & top header
  Header.render('Student Healthcare Dashboard');
  StudentSidebar.render();

  // Set greeting & current date eyebrow
  renderWelcomeRow(user);

  // Load appointment and queue state
  loadDashboardData();

  dashboardPoller = SyncManager.createPoller({
    name: 'student-dashboard-sync',
    interval: 10000,
    fetchFn: () => loadDashboardData(),
    immediate: false
  });
  dashboardPoller.start();
});

function renderWelcomeRow(user) {
  const dateEyebrow = document.getElementById('dashboard-date-eyebrow');
  const welcomeName = document.getElementById('welcome-student-name');

  const now = new Date();
  const options = { weekday: 'long', day: 'numeric', month: 'long' };
  const formattedDate = now.toLocaleDateString('en-GB', options);

  if (dateEyebrow) {
    dateEyebrow.textContent = formattedDate;
  }

  const hours = now.getHours();
  let greeting = 'Good morning';
  if (hours >= 12 && hours < 17) greeting = 'Good afternoon';
  else if (hours >= 17) greeting = 'Good evening';

  const firstName = (user.name || 'Student').split(' ')[0];
  if (welcomeName) {
    welcomeName.textContent = `${greeting}, ${firstName}.`;
  }
}

async function loadDashboardData() {
  const user = Storage.get(APP_CONFIG.STORAGE_KEYS.AUTH_USER);
  const appointments = (await AppointmentService.getAllAppointments()).filter(a => a.studentId === user.id || a.matricNo === user.matricNo);
  const doctors = Storage.get(APP_CONFIG.STORAGE_KEYS.DOCTORS, []);
  const queue = Storage.get(APP_CONFIG.STORAGE_KEYS.QUEUE, []);

  // Today's day of week name
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const todayName = dayNames[new Date().getDay()];

  // Filter available doctors
  const doctorsToday = doctors.filter(
    (d) => (d.workingDays || []).includes(todayName) && d.isAvailable
  );

  const statDoctors = document.getElementById('stat-doctors-today');
  const statSlot = document.getElementById('stat-next-slot');

  if (statDoctors) {
    statDoctors.textContent = doctorsToday.length;
  }
  if (statSlot) {
    const services = Storage.get(APP_CONFIG.STORAGE_KEYS.SERVICES, []);
    const slot = services.flatMap(s => availableSlots(s.id, null, localDate()))[0];
    statSlot.textContent = slot?.time || 'No slots';
  }

  renderUpcomingAppointment(appointments);
  renderQueueStatus(queue, appointments);
}

function renderUpcomingAppointment(appointments) {
  const container = document.getElementById('latest-appointment-container');
  if (!container) return;

  // Find most relevant student appointment (excluding cancelled)
  const activeAppt = appointments.find(
    (a) => !['Cancelled', 'Rejected', 'Completed', 'No Show'].includes(a.status)
  );

  if (!activeAppt) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="quiet-icon">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect width="18" height="18" x="3" y="4" rx="2" ry="2"></rect>
            <line x1="16" y1="2" x2="16" y2="6"></line>
            <line x1="8" y1="2" x2="8" y2="6"></line>
            <line x1="3" y1="10" x2="21" y2="10"></line>
          </svg>
        </div>
        <h3>No upcoming appointments</h3>
        <p>When you book a visit, the appointment details will appear here.</p>
        <a href="book-appointment.html" class="button button-primary">Book Appointment</a>
      </div>
    `;
    return;
  }

  // Format date parts
  let month = 'MAY';
  let dayNum = '15';
  let dayName = 'Thursday';

  if (activeAppt.appointmentDate) {
    const d = new Date(activeAppt.appointmentDate);
    if (!isNaN(d.getTime())) {
      month = d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
      dayNum = d.getDate();
      dayName = d.toLocaleDateString('en-US', { weekday: 'long' });
    }
  }

  // Status badge logic
  let badgeTone = 'badge-warning';
  let statusText = 'Pending Approval';

  if (activeAppt.status === APP_CONFIG.APPOINTMENT_STATUS.APPROVED) {
    badgeTone = 'badge-success';
    statusText = 'Confirmed';
  } else if (activeAppt.status === APP_CONFIG.APPOINTMENT_STATUS.REJECTED) {
    badgeTone = 'badge-danger';
    statusText = 'Rejected';
  } else if (activeAppt.status === APP_CONFIG.APPOINTMENT_STATUS.CHECKED_IN) {
    badgeTone = 'badge-info';
    statusText = 'Checked In';
  }

  container.innerHTML = `
    <article class="appointment-card">
      <div class="appointment-date">
        <span>${month}</span>
        <strong>${dayNum}</strong>
        <small>${dayName}</small>
      </div>
      <div class="appointment-main">
        <div class="card-title-row">
          <div>
            <h3>${activeAppt.serviceName || 'General Consultation'}</h3>
            <p>${activeAppt.doctorName || 'Dr. Nneka Okafor'}</p>
          </div>
          <span class="badge ${badgeTone}">
            <span class="badge-dot"></span>
            ${statusText}
          </span>
        </div>
        <div class="appointment-meta">
          <span>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
            ${activeAppt.timeSlot || '10:30 AM'}
          </span>
          <span>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
              <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path>
              <rect width="8" height="4" x="8" y="2" rx="1" ry="1"></rect>
            </svg>
            Care-OAU Clinic
          </span>
        </div>
        <div class="appointment-actions">
          <span>Ref: ${activeAppt.referenceNo || activeAppt.id}</span>
          <a href="my-appointments.html" class="button button-secondary">
            View appointment
          </a>
        </div>
      </div>
    </article>
  `;
}

function renderQueueStatus(queue, appointments) {
  const container = document.getElementById('queue-status-container');
  if (!container) return;

  // Check if student has checked in
  const user = Storage.get(APP_CONFIG.STORAGE_KEYS.AUTH_USER);
  const userMatric = user ? user.matricNo : '21/SCI/1048';

  const checkedInEntry = queue.find(
    (q) => (q.patientId === userMatric || q.matricNo === userMatric) && ['Waiting', 'Called', 'In Consultation'].includes(q.status)
  );

  if (!checkedInEntry) {
    container.innerHTML = `
      <div class="quiet-card">
        <div class="quiet-icon">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"></circle>
            <polyline points="12 6 12 12 16 14"></polyline>
          </svg>
        </div>
        <h3>Queue tracking starts at check-in</h3>
        <p>When reception checks you in, your queue number and estimated wait will appear here.</p>
        <a href="queue-tracking.html" class="text-link">
          How queue tracking works
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="9 18 15 12 9 6"></polyline>
          </svg>
        </a>
      </div>
    `;
    return;
  }

  // If student is checked in
  let statusBadge = '<span class="badge badge-warning"><span class="badge-dot"></span>Waiting</span>';
  if (checkedInEntry.status === 'Called') {
    statusBadge = '<span class="badge badge-info"><span class="badge-dot"></span>Called</span>';
  } else if (checkedInEntry.status === 'In Consultation') {
    statusBadge = '<span class="badge badge-info"><span class="badge-dot"></span>In Progress</span>';
  } else if (checkedInEntry.status === 'completed') {
    statusBadge = '<span class="badge badge-success"><span class="badge-dot"></span>Completed</span>';
  }

  container.innerHTML = `
    <div class="queue-mini">
      <div>
        <span>Your queue number</span>
        <strong>${checkedInEntry.ticketNo || checkedInEntry.queueNumber || 'Q-021'}</strong>
      </div>
      <div>
        <span>Current status</span>
        ${statusBadge}
      </div>
      <div>
        <span>Estimated wait</span>
        <strong>${checkedInEntry.estimatedWait || '~15 mins'}</strong>
      </div>
      <a href="queue-tracking.html" class="button button-primary full" style="margin-top: 4px;">
        Track Live Queue Position
      </a>
    </div>
  `;
}

window.addEventListener('storage', event => { if (event.key?.startsWith('care_oau_')) loadDashboardData(); });
