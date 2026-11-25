import { Navigation } from '../core/navigation.js';
/**
 * Care-OAU - Admin Queue Management Logic
 * Controls outpatient queue callboard, patient transitions (Called, In Progress, Completed, No-Show),
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
const expandedQueueItems = new Set();

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

  // Queue list interactions
  const queueList = document.getElementById('queue-list');

  if (queueList) {
    queueList.addEventListener('click', event => {
      const toggle = event.target.closest('[data-queue-toggle]');

      if (toggle) {
        const queueId = toggle.dataset.queueId;

        if (expandedQueueItems.has(queueId)) {
          expandedQueueItems.delete(queueId);
        } else {
          expandedQueueItems.add(queueId);
        }

        refreshQueue();
        return;
      }

      const action = event.target.closest('[data-queue-action]');

      if (action && action.dataset.queueAction === 'no-show') {
        window.qmMarkNoShowDirect(action.dataset.queueId);
      }
    });
  }

  // Caller console buttons
  const btnCallNext = document.getElementById('qm-btn-call-next');
  const btnStart = document.getElementById('qm-btn-start-consult');
  const btnComplete = document.getElementById('qm-btn-complete');
  const btnNoShow = document.getElementById('qm-btn-noshow');
  const btnEmergency = document.getElementById('btn-emergency-call');

  // Call next patient
  if (btnCallNext) {
    btnCallNext.addEventListener('click', async () => {
      const res = await QueueService.callNextPatient();

      if (res.success) {
        Toast.success(
          `Now Calling Ticket ${res.patient.queueNumber}: ${res.patient?.studentName || 'Student'}`
        );
        refreshQueue();
      } else {
        Toast.info(res.message);
      }
    });
  }

  // Start consultation
  if (btnStart) {
    btnStart.addEventListener('click', async () => {
      if (!currentActiveItem) return;

      const result = await QueueService.startConsultation(currentActiveItem.id);

      if (!result?.success) {
        Toast.warning(result?.message || 'Unable to start consultation.');
        return;
      }

      Toast.success(
        `Consultation started for ${currentActiveItem?.studentName || 'Student'}`
      );

      refreshQueue();
    });
  }

  // Complete visit
  if (btnComplete) {
    btnComplete.addEventListener('click', async () => {
      if (!currentActiveItem) return;

      const result = await QueueService.completeVisit(currentActiveItem.id);

      if (!result?.success) {
        Toast.warning(result?.message || 'Unable to complete this visit.');
        return;
      }

      Toast.success(
        `Consultation completed for ${currentActiveItem?.studentName || 'Student'} (${currentActiveItem.queueNumber})`
      );

      refreshQueue();
    });
  }

  // Mark active patient as No Show
  if (btnNoShow) {
    btnNoShow.addEventListener('click', () => {
      if (!currentActiveItem) return;

      const patient = currentActiveItem;

      Modal.confirm({
        title: 'Mark as No Show?',
        message: `Mark patient ${patient?.studentName || 'Student'} (${patient.queueNumber}) as absent after repeated calls?`,
        confirmText: 'Mark No Show',
        confirmClass: 'btn-danger',

        onConfirm: async () => {
          const result = await QueueService.markNoShow(patient.id);

          if (!result.success) {
            Toast.warning(result.message);
            return false;
          }

          Toast.warning(
            `${patient?.studentName || 'Student'} marked as No Show.`
          );

          refreshQueue();
        }
      });
    });
  }

  // Emergency triage override
  if (btnEmergency) {
    btnEmergency.addEventListener('click', () => {
      Modal.confirm({
        title: 'Emergency Triage Override',
        message: 'Insert an immediate critical priority emergency case to the front of the consulting queue?',
        confirmText: 'Dispatch Emergency Case',
        confirmClass: 'btn-danger',

        onConfirm: async () => {
          const queue = await QueueService.getQueue();

          const emergencyItem = {
            id: `emg_${Date.now()}`,
            queueNumber: `EMG-${Math.floor(10 + Math.random() * 90)}`,
            patientName: 'Emergency Triage Patient',
            matricNo: 'EMERGENCY',
            doctorName: 'Dr. O. A. Adeleke',
            serviceName: 'Emergency Triage & Resuscitation',
            room: 'Emergency Bay 1',
            status: APP_CONFIG.QUEUE_STATUS.CALLED,
            checkInTime: new Date().toISOString()
          };

          Storage.set(
            APP_CONFIG.STORAGE_KEYS.QUEUE,
            [emergencyItem, ...queue]
          );

          Toast.warning(
            `Emergency Patient ${emergencyItem.queueNumber} dispatched to Emergency Bay 1!`
          );

          refreshQueue();
        }
      });
    });
  }
}

async function refreshQueue() {
  const queue = await QueueService.getQueue();

  // Find active caller item
  currentActiveItem = queue.find(q => q.status === APP_CONFIG.QUEUE_STATUS.IN_PROGRESS) ||
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
    if (elName) elName.textContent = `${currentActiveItem?.studentName || 'Student'} (${currentActiveItem.matricNo})`;
    if (elRoom) elRoom.textContent = `${currentActiveItem.room || 'Room 2'}  -  ${currentActiveItem.serviceName}  -  Status: ${currentActiveItem.status}`;

    if (btnStart) {
      btnStart.disabled = (currentActiveItem.status === APP_CONFIG.QUEUE_STATUS.IN_PROGRESS);
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
  const queueList = document.getElementById('queue-list');
  const patientCount = document.getElementById('qm-patient-count');

  if (!queueList) return;

  const filtered = queue.filter(item => {
    if (activeStatusFilter === 'all') return true;
    return item.status === activeStatusFilter;
  });

  if (patientCount) {
    patientCount.textContent = `${filtered.length} patient${filtered.length === 1 ? '' : 's'}`;
  }

  if (filtered.length === 0) {
    queueList.innerHTML = `
      <div class="queue-empty-state">
        No patients with this status right now.
      </div>
    `;
    return;
  }

  queueList.innerHTML = filtered.map((item, index) => {
    const queueId = String(item.id || item.publicId || '');
    const safeId = Utils.escapeHtml(queueId);
    const detailsId = `queue-details-${index}`;
    const isExpanded = expandedQueueItems.has(queueId);

    const status = String(item.status || '').toLowerCase()
      .replace(/\s+/g, '-');

    const isCalled = item.status === APP_CONFIG.QUEUE_STATUS.CALLED;
    const isWaiting = item.status === APP_CONFIG.QUEUE_STATUS.WAITING;

    const isFinished = [
      APP_CONFIG.QUEUE_STATUS.COMPLETED,
      APP_CONFIG.QUEUE_STATUS.NO_SHOW,
      'Cancelled'
    ].includes(item.status);

    const canMarkNoShow = isCalled;
    const canCancel = false; // Backend cancellation is not implemented yet.

    const studentName = Utils.escapeHtml(item.studentName || item.patientName || 'Student');
    const matricNo = Utils.escapeHtml(item.matricNo || 'Not available');
    const serviceName = Utils.escapeHtml(item.serviceName || 'General Consultation');
    const consultingRoom = Utils.escapeHtml(item.room || 'Not assigned');
    const queueNumber = Utils.escapeHtml(item.queueNumber || '---');
    const checkInTime = Utils.escapeHtml(Utils.formatTime(item.checkInTime) || 'Today');

    return `
      <article
        class="queue-item ${isExpanded ? 'expanded' : ''} ${isFinished ? 'queue-item-finished' : ''}"
        data-status="${Utils.escapeHtml(status)}"
      >
        <button
          type="button"
          class="queue-item-header"
          data-queue-toggle
          data-queue-id="${safeId}"
          aria-expanded="${isExpanded}"
          aria-controls="${detailsId}"
        >
          <span class="queue-number">${queueNumber}</span>

          <span class="queue-student">
            <span class="queue-student-name">${studentName}</span>
          </span>

          <span class="queue-service">${serviceName}</span>

          <span class="queue-status">
            ${Utils.getStatusBadge(item.status)}
          </span>

          <span class="queue-chevron" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24"
              fill="none" stroke="currentColor" stroke-width="2">
              <path d="m6 9 6 6 6-6"/>
            </svg>
          </span>
        </button>

        <div
          class="queue-item-details"
          id="${detailsId}"
          ${isExpanded ? '' : 'hidden'}
        >
          <div class="queue-details-grid">
            <div class="queue-detail">
              <span class="queue-detail-label">Matric Number</span>
              <span class="queue-detail-value">${matricNo}</span>
            </div>

            <div class="queue-detail">
              <span class="queue-detail-label">Consulting Room</span>
              <span class="queue-detail-value">${consultingRoom}</span>
            </div>

            <div class="queue-detail">
              <span class="queue-detail-label">Check-in Time</span>
              <span class="queue-detail-value">${checkInTime}</span>
            </div>
          </div>

          <div class="queue-item-actions">
            ${
              isFinished
                ? `<span class="queue-no-actions">No further actions</span>`
                : `
                  <button
                    type="button"
                    class="btn btn-outline-danger btn-sm queue-action-cancel"
                    data-queue-action="cancel"
                    data-queue-id="${safeId}"
                    disabled
                    title="Queue cancellation is not available yet"
                  >
                    Cancel
                  </button>

                  ${
                    isWaiting || isCalled
                      ? `
                        <button
                          type="button"
                          class="btn btn-outline-danger btn-sm"
                          data-queue-action="no-show"
                          data-queue-id="${safeId}"
                          ${canMarkNoShow ? '' : 'disabled title="Only called patients can be marked as No Show"'}
                        >
                          Mark as No Show
                        </button>
                      `
                      : ''
                  }
                `
            }
          </div>
        </div>
      </article>
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
  const queue = await QueueService.getQueue();
  const patient = queue.find(q => q.id === id || q.publicId === id);

  if (!patient || patient.status !== APP_CONFIG.QUEUE_STATUS.CALLED) {
    Toast.warning('Only called patients can be marked as No Show.');
    return;
  }

  Modal.confirm({
    title: 'Mark as No Show?',
    message: `Mark ${patient.studentName || 'Student'} (${patient.queueNumber}) as No Show?`,
    confirmText: 'Mark as No Show',
    confirmClass: 'btn-danger',
    onConfirm: async () => {
      const result = await QueueService.markNoShow(id);

      if (!result.success) {
        Toast.warning(result.message);
        return false;
      }

      expandedQueueItems.delete(id);
      Toast.warning(`${patient.studentName || 'Student'} marked as No Show.`);
      await refreshQueue();
    }
  });
};

window.addEventListener('storage', event => { if (event.key?.startsWith('care_oau_')) refreshQueue(); });
