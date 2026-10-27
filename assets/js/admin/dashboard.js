import { Navigation } from '../core/navigation.js';
/**
 * Care-OAU - Admin / Staff Dashboard Logic
 * Displays clinic operational metrics, manages the patient calling console,
 * and facilitates rapid triage approvals and doctor capacity monitoring.
 */

import { Storage } from '../core/storage.js';
import { APP_CONFIG } from '../core/config.js';
import { AdminSidebar } from '../components/admin-sidebar.js';
import { Header } from '../components/header.js';
import { QueueService } from '../services/queue-service.js';
import { AppointmentService } from '../services/appointment-service.js';
import { DoctorService } from '../services/doctor-service.js';
import { Toast } from '../components/toast.js';
import { Modal } from '../components/modal.js';
import { Utils } from '../core/utils.js';
import { INITIAL_APPOINTMENTS, INITIAL_QUEUE, INITIAL_SERVICES } from '../data/mock-data.js';

let currentCallerItem = null;

document.addEventListener('DOMContentLoaded', () => {
  if (!Navigation.requireAuth('admin')) return;
  DoctorService.purgeLegacyDemoDoctors();
  let user = Storage.get(APP_CONFIG.STORAGE_KEYS.AUTH_USER);
  if (!user || user.role !== 'admin') {
    if (APP_CONFIG.USE_MOCK_DATA) {
      user = {
        id: 'staff_adm_001',
        name: 'Dr. T. A. Babalola',
        staffId: 'STAFF/MED/002',
        role: 'admin',
        department: 'Health Centre Administration'
      };
      Storage.set(APP_CONFIG.STORAGE_KEYS.AUTH_USER, user);
    } else {
      window.location.href = 'login.html';
      return;
    }
  }

  // Ensure storage seeded only in mock/test mode
  if (APP_CONFIG.USE_MOCK_DATA) {
    if (!Storage.get(APP_CONFIG.STORAGE_KEYS.APPOINTMENTS)) Storage.set(APP_CONFIG.STORAGE_KEYS.APPOINTMENTS, INITIAL_APPOINTMENTS);
    if (!Storage.get(APP_CONFIG.STORAGE_KEYS.QUEUE)) Storage.set(APP_CONFIG.STORAGE_KEYS.QUEUE, INITIAL_QUEUE);
    if (!Storage.get(APP_CONFIG.STORAGE_KEYS.SERVICES)) Storage.set(APP_CONFIG.STORAGE_KEYS.SERVICES, INITIAL_SERVICES);
  }

  const greeting = document.getElementById('admin-welcome-name');
  if (greeting) greeting.textContent = 'Welcome, ' + user.name + '.';
  Header.render('Staff Dashboard');
  AdminSidebar.render();

  setupCallerControls();
  refreshDashboardData();
});

async function refreshDashboardData() {
  const appointments = await AppointmentService.getAllAppointments();
  const queue = await QueueService.getQueue();
  const doctors = await DoctorService.getAllDoctors();

  // 1. Calculate Metrics
  const pendingRequests = appointments.filter(a => a.status === APP_CONFIG.APPOINTMENT_STATUS.PENDING).length;
  const approvedToday = appointments.filter(a => a.status === APP_CONFIG.APPOINTMENT_STATUS.APPROVED && a.appointmentDate === Utils.getTodayDateString()).length;
  const waitingPatients = queue.filter(q => q.status === APP_CONFIG.QUEUE_STATUS.WAITING).length;
  const completedVisits = queue.filter(q => q.status === APP_CONFIG.QUEUE_STATUS.COMPLETED).length;

  const elPending = document.getElementById('stat-pending-requests');
  const elApproved = document.getElementById('stat-approved-today');
  const elWaiting = document.getElementById('stat-waiting-queue');
  const elCompleted = document.getElementById('stat-completed-visits');

  if (elPending) elPending.textContent = pendingRequests;
  if (elApproved) elApproved.textContent = approvedToday;
  if (elWaiting) elWaiting.textContent = waitingPatients;
  if (elCompleted) elCompleted.textContent = completedVisits;

  // 2. Caller State
  updateCallerDisplay(queue);

  // 3. Render Pending Requests Table
  renderPendingTable(appointments);

  // 4. Render Doctor Workloads
  renderDoctorWorkloads(doctors);

  AdminSidebar.render();
}

function updateCallerDisplay(queue) {
  // Find patient in consultation or called
  currentCallerItem = queue.find(q => q.status === APP_CONFIG.QUEUE_STATUS.IN_CONSULTATION) ||
                      queue.find(q => q.status === APP_CONFIG.QUEUE_STATUS.CALLED) ||
                      null;

  const elNum = document.getElementById('caller-ticket-number');
  const elName = document.getElementById('caller-patient-name');
  const elInfo = document.getElementById('caller-service-info');
  const btnStart = document.getElementById('btn-start-consult');
  const btnComplete = document.getElementById('btn-complete-visit');

  if (!currentCallerItem) {
    if (elNum) elNum.textContent = '---';
    if (elName) elName.textContent = 'No active consultation';
    if (elInfo) elInfo.textContent = 'Ready to call next patient from waiting area';
    if (btnStart) btnStart.disabled = true;
    if (btnComplete) btnComplete.disabled = true;
  } else {
    if (elNum) elNum.textContent = currentCallerItem.queueNumber;
    if (elName) elName.textContent = `${currentCallerItem.patientName} (${currentCallerItem.matricNo})`;
    if (elInfo) elInfo.textContent = `${currentCallerItem.serviceName}  -  Status: ${currentCallerItem.status}`;
    
    if (btnStart) {
      btnStart.disabled = (currentCallerItem.status === APP_CONFIG.QUEUE_STATUS.IN_CONSULTATION);
    }
    if (btnComplete) {
      btnComplete.disabled = false;
    }
  }
}

function setupCallerControls() {
  const btnCallNext = document.getElementById('btn-call-next');
  const btnStart = document.getElementById('btn-start-consult');
  const btnComplete = document.getElementById('btn-complete-visit');

  if (btnCallNext) {
    btnCallNext.addEventListener('click', async () => {
      const res = await QueueService.callNextPatient();
      if (res.success) {
        Toast.success(`Called patient ticket ${res.patient.queueNumber}: ${res.patient.patientName}!`);
        refreshDashboardData();
      } else {
        Toast.info(res.message);
      }
    });
  }

  if (btnStart) {
    btnStart.addEventListener('click', async () => {
      if (!currentCallerItem) return;
      await QueueService.startConsultation(currentCallerItem.id);
      Toast.success(`Consultation started with ${currentCallerItem.patientName}`);
      refreshDashboardData();
    });
  }

  if (btnComplete) {
    btnComplete.addEventListener('click', async () => {
      if (!currentCallerItem) return;
      await QueueService.completeVisit(currentCallerItem.id);
      Toast.success(`Visit completed for ${currentCallerItem.patientName} (${currentCallerItem.queueNumber})`);
      refreshDashboardData();
    });
  }
}

function renderPendingTable(appointments) {
  const tbody = document.getElementById('dashboard-requests-tbody');
  if (!tbody) return;

  const pendingList = appointments.filter(a => a.status === APP_CONFIG.APPOINTMENT_STATUS.PENDING);

  if (pendingList.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="3" style="text-align: center; padding: var(--space-6);">
          <p class="text-xs text-muted">No pending triage requests at this moment.</p>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = pendingList.slice(0, 5).map(apt => `
    <tr>
      <td>
        <div class="text-sm text-bold text-navy">${Utils.escapeHtml(apt.studentName)}</div>
        <div class="text-xs text-muted">${Utils.escapeHtml(apt.matricNo)}</div>
      </td>
      <td>
        <div class="text-xs text-teal text-semibold">${Utils.escapeHtml(apt.serviceName)}</div>
        <div class="text-xs text-secondary">${Utils.formatDate(apt.appointmentDate)}  -  ${apt.timeSlot}</div>
      </td>
      <td style="text-align: right;">
        <div style="display: inline-flex; gap: 4px;">
          <button type="button" class="btn btn-teal btn-sm" onclick="window.quickApproveRequest('${apt.id}')">
            Approve
          </button>
          <button type="button" class="btn btn-outline-danger btn-sm" onclick="window.quickRejectRequest('${apt.id}')">
            Reject
          </button>
        </div>
      </td>
    </tr>
  `).join('');
}

function renderDoctorWorkloads(doctors) {
  const container = document.getElementById('dashboard-doctor-workloads');
  if (!container) return;

  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const todayName = dayNames[new Date().getDay()];

  const doctorsToday = doctors.filter(d => (d.workingDays || []).includes(todayName));

  if (doctorsToday.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="padding: var(--space-6) 0;">
        <p class="text-xs text-muted">No doctors rostered for duty today (${todayName}).</p>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div style="display: flex; flex-direction: column; gap: var(--space-3);">
      ${doctorsToday.map(doc => {
        const isFull = (doc.currentLoad || 0) >= (doc.dailyCapacity || 25);
        const capacityPct = Math.min(100, Math.round(((doc.currentLoad || 0) / (doc.dailyCapacity || 25)) * 100));

        return `
          <div style="padding: 10px; border: 1px solid var(--color-divider); border-radius: var(--radius-md); background: ${isFull ? '#FFFBEB' : 'transparent'};">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
              <div>
                <span class="text-sm text-bold text-navy">${Utils.escapeHtml(doc.name)}</span>
                <span class="text-xs text-muted"> (${Utils.escapeHtml(doc.specialization)})</span>
              </div>
              <span class="badge ${isFull ? 'badge-danger' : 'badge-mint'}" style="font-size: 11px;">
                ${doc.currentLoad || 0} / ${doc.dailyCapacity} Booked
              </span>
            </div>
            <div class="capacity-bar" style="margin-top: 6px;">
              <div class="capacity-fill ${isFull ? 'full' : (capacityPct >= 75 ? 'high' : '')}" style="width: ${capacityPct}%;"></div>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

// Global quick approve / reject actions
window.quickApproveRequest = async (id) => {
  await AppointmentService.approveAppointment(id);
  Toast.success('Appointment request approved! Ready for patient check-in.');
  refreshDashboardData();
};

window.quickRejectRequest = (id) => {
  Modal.confirm({
    title: 'Reject Appointment Request',
    message: '<label class="form-label" for="rejection-reason">Reason for rejection</label><textarea id="rejection-reason" class="form-control" rows="3"></textarea>',
    confirmText: 'Reject Request',
    confirmClass: 'btn-danger',
    onConfirm: async () => {
      const reason = document.getElementById('rejection-reason').value.trim();
      if (!reason) { Toast.warning('Please enter a reason.'); return false; }
      await AppointmentService.rejectAppointment(id, reason);
      Toast.warning('Appointment request rejected.');
      refreshDashboardData();
    }
  });
};

window.addEventListener('storage', event => { if (event.key?.startsWith('care_oau_')) refreshDashboardData(); });
