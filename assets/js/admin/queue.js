import { Navigation } from '../core/navigation.js';
/**
 * Care-OAU - Admin Queue Management Logic
 * Controls outpatient queue callboard, patient transitions (Called, In Consultation, Completed, No-Show),
 * and emergency triage overrides.
 */

import { QueueService } from '../services/queue-service.js';
import { AdminSidebar } from '../components/admin-sidebar.js';
import { Header } from '../components/header.js';
import { Toast } from '../components/toast.js';
import { Modal } from '../components/modal.js';
import { Utils } from '../core/utils.js';
import { APP_CONFIG } from '../core/config.js';
import { Storage } from '../core/storage.js';

let activeStatusFilter = 'all';
let currentActiveItem = null;

document.addEventListener('DOMContentLoaded', () => {
  if (!Navigation.requireAuth('admin')) return;
  Header.render('Clinic Queue Management & Callboard');
  AdminSidebar.render();

  initControls();
  refreshQueue();
});

function initControls() {
  const tabs = document.getElementById('queue-status-tabs');
  if (tabs) {
    tabs.querySelectorAll('.tab-filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        tabs.querySelectorAll('.tab-filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        activeStatusFilter = btn.dataset.status;
        refreshQueue();
      });
    });
  }

  // Caller console buttons
  const btnCallNext = document.getElementById('qm-btn-call-next');
  const btnStart = document.getElementById('qm-btn-start-consult');
  const btnComplete = document.getElementById('qm-btn-complete');
  const btnNoShow = document.getElementById('qm-btn-noshow');
  const btnEmergency = document.getElementById('btn-emergency-call');

  if (btnCallNext) {
    btnCallNext.addEventListener('click', async () => {
      const res = await QueueService.callNextPatient();
      if (res.success) {
        Toast.success(`Now Calling Ticket ${res.patient.queueNumber}: ${res.patient.patientName}`);
        refreshQueue();
      } else {
        Toast.info(res.message);
      }
    });
  }

  if (btnStart) {
    btnStart.addEventListener('click', async () => {
      if (!currentActiveItem) return;
      await QueueService.startConsultation(currentActiveItem.id);
      Toast.success(`Consultation started for ${currentActiveItem.patientName}`);
      refreshQueue();
    });
  }

  if (btnComplete) {
    btnComplete.addEventListener('click', async () => {
      if (!currentActiveItem) return;
      await QueueService.completeVisit(currentActiveItem.id);
      Toast.success(`Consultation completed for ${currentActiveItem.patientName} (${currentActiveItem.queueNumber})`);
      refreshQueue();
    });
  }

  if (btnNoShow) {
    btnNoShow.addEventListener('click', () => {
      if (!currentActiveItem) return;
      Modal.confirm({
        title: 'Mark as No Show?',
        message: `Mark patient ${currentActiveItem.patientName} (${currentActiveItem.queueNumber}) as absent after repeated calls?`,
        confirmText: 'Mark No Show',
        confirmClass: 'btn-danger',
        onConfirm: async () => {
          const result = await QueueService.markNoShow(currentActiveItem.id);
          if (!result.success) { Toast.warning(result.message); return false; }
          Toast.warning(`${currentActiveItem.patientName} marked as No Show.`);
          refreshQueue();
        }
      });
    });
  }

  if (btnEmergency) {
    btnEmergency.addEventListener('click', () => {
      Modal.confirm({
        title: 'Emergency Triage Override',
        message: 'Insert an immediate critical priority emergency case to the front of the consulting queue?',
        confirmText: 'Dispatch Emergency Case',
        confirmClass: 'btn-danger',
        onConfirm: async () => {
          let queue = await QueueService.getQueue();
          const emergencyItem = {
            id: `emg_${Date.now()}`,
            queueNumber: `EMG-${Math.floor(10 + Math.random() * 90)}`,
            patientName: 'Emergency Triage Patient',
            matricNo: 'EMERGENCY',
            doctorName: 'Dr. O. A. Adeleke',
            serviceName: 'Emergency Triage & Resuscitation',
            room: 'Emergency Bay 1',
            status: APP_CONFIG.QUEUE_STATUS.CALLED,
            checkInTime: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
          };
          queue = [emergencyItem, ...queue];
          Storage.set(APP_CONFIG.STORAGE_KEYS.QUEUE, queue);
          Toast.warning(`Emergency Patient ${emergencyItem.queueNumber} dispatched to Emergency Bay 1!`);
          refreshQueue();
        }
      });
    });
  }
}

async function refreshQueue() {
  const queue = await QueueService.getQueue();

  // Find active caller item
  currentActiveItem = queue.find(q => q.status === APP_CONFIG.QUEUE_STATUS.IN_CONSULTATION) ||
                      queue.find(q => q.status === APP_CONFIG.QUEUE_STATUS.CALLED) ||
                      null;

  updateCallerUI();

  // Count waiting
  const waitingCount = queue.filter(q => q.status === APP_CONFIG.QUEUE_STATUS.WAITING).length;
  const countBadge = document.getElementById('qm-waiting-count-badge');
  if (countBadge) {
    countBadge.innerHTML = `<strong>${waitingCount}</strong> patient${waitingCount === 1 ? '' : 's'} waiting in lobby`;
  }

  // Render Table
  renderQueueTable(queue);
  AdminSidebar.render();
}

function updateCallerUI() {
  const elNum = document.getElementById('qm-ticket-number');
  const elName = document.getElementById('qm-patient-name');
  const elRoom = document.getElementById('qm-clinic-room');
  const btnStart = document.getElementById('qm-btn-start-consult');
  const btnComplete = document.getElementById('qm-btn-complete');
  const btnNoShow = document.getElementById('qm-btn-noshow');

  if (!currentActiveItem) {
    if (elNum) elNum.textContent = '---';
    if (elName) elName.textContent = 'No patient currently called';
    if (elRoom) elRoom.textContent = 'Consulting Room 2  -  General Outpatient Clinic';
    if (btnStart) btnStart.disabled = true;
    if (btnComplete) btnComplete.disabled = true;
    if (btnNoShow) btnNoShow.disabled = true;
  } else {
    if (elNum) elNum.textContent = currentActiveItem.queueNumber;
    if (elName) elName.textContent = `${currentActiveItem.patientName} (${currentActiveItem.matricNo})`;
    if (elRoom) elRoom.textContent = `${currentActiveItem.room || 'Room 2'}  -  ${currentActiveItem.serviceName}  -  Status: ${currentActiveItem.status}`;

    if (btnStart) {
      btnStart.disabled = (currentActiveItem.status === APP_CONFIG.QUEUE_STATUS.IN_CONSULTATION);
    }
    if (btnComplete) {
      btnComplete.disabled = false;
    }
    if (btnNoShow) {
      btnNoShow.disabled = false;
    }
  }
}

function renderQueueTable(queue) {
  const tbody = document.getElementById('queue-tbody');
  if (!tbody) return;

  const filtered = queue.filter(item => {
    if (activeStatusFilter === 'all') return true;
    return item.status === activeStatusFilter;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align: center; padding: var(--space-8);">
          <p class="text-xs text-muted">No patient records under "${activeStatusFilter}".</p>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = filtered.map(item => {
    const isWaiting = item.status === APP_CONFIG.QUEUE_STATUS.WAITING;
    const isCalled = item.status === APP_CONFIG.QUEUE_STATUS.CALLED;
    const isInConsult = item.status === APP_CONFIG.QUEUE_STATUS.IN_CONSULTATION;

    return `
      <tr>
        <td>
          <span class="badge ${item.queueNumber.startsWith('EMG') ? 'badge-danger' : 'badge-teal'}" style="font-size: 13px; font-weight: 800;">
            ${item.queueNumber}
          </span>
        </td>
        <td>
          <div class="text-sm text-bold text-navy">${Utils.escapeHtml(item.patientName)}</div>
          <div class="text-xs text-muted">${Utils.escapeHtml(item.matricNo)}</div>
        </td>
        <td>
          <div class="text-sm">${Utils.escapeHtml(item.serviceName)}</div>
          <div class="text-xs text-teal">${item.room || 'Consulting Room 2'}</div>
        </td>
        <td>
          <div class="text-xs text-secondary">${item.checkInTime || 'Today'}</div>
        </td>
        <td>
          ${Utils.getStatusBadge(item.status)}
        </td>
        <td style="text-align: right;">
          <div style="display: inline-flex; gap: 6px; align-items: center;">
            ${isWaiting ? `
              <button type="button" class="btn btn-teal btn-sm" onclick="window.qmCallDirect('${item.id}', '${item.queueNumber}')">
                Call Now
              </button>
            ` : ''}

            ${isCalled ? `
              <button type="button" class="btn btn-outline-teal btn-sm" onclick="window.qmStartDirect('${item.id}')">
                Start Visit
              </button>
            ` : ''}

            ${isInConsult ? `
              <button type="button" class="btn btn-success btn-sm" onclick="window.qmCompleteDirect('${item.id}')">
                Complete
              </button>
            ` : ''}

            ${(isWaiting || isCalled) ? `
              <button type="button" class="btn btn-ghost btn-sm text-danger" onclick="window.qmMarkNoShowDirect('${item.id}')">
                No Show
              </button>
            ` : ''}
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

// Global direct row triggers
window.qmCallDirect = async (id, queueNum) => {
  const result = await QueueService.callPatient(id);
  if (!result.success) { Toast.warning(result.message); return; }
  Toast.success(`Calling Ticket ${queueNum}`);
  refreshQueue();
};

window.qmStartDirect = async (id) => {
  await QueueService.startConsultation(id);
  Toast.success('Consultation session initiated.');
  refreshQueue();
};

window.qmCompleteDirect = async (id) => {
  await QueueService.completeVisit(id);
  Toast.success('Visit finalized.');
  refreshQueue();
};

window.qmMarkNoShowDirect = async (id) => {
  const result = await QueueService.markNoShow(id);
  if (!result.success) { Toast.warning(result.message); return; }
  Toast.warning(result.patient.patientName + ' marked as No Show.');
  refreshQueue();
};

window.addEventListener('storage', event => { if (event.key?.startsWith('care_oau_')) refreshQueue(); });
