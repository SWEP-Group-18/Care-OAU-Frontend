import { DOCTOR_STATUSES, attendanceStatus, statusTone, doctorLoad, saveDoctorStatus } from '../services/doctor-status.js';
import { Utils } from '../core/utils.js';
import { Navigation } from '../core/navigation.js';
/**
 * Care-OAU - Admin Doctor Management Logic
 * Configures doctor schedules, working days, daily capacity limits, and on-leave toggles.
 */

import { DoctorService } from '../services/doctor-service.js';
import { MedicalService } from '../services/medical-service.js';
import { INITIAL_SERVICES } from '../data/mock-data.js';
import { AdminSidebar } from '../components/admin-sidebar.js';
import { Header } from '../components/header.js';
import { Modal } from '../components/modal.js';
import { Toast } from '../components/toast.js';
import { Dropdown } from '../components/dropdown.js';
import { FormValidator } from '../components/form-validation.js';
import { Storage } from '../core/storage.js';
import { APP_CONFIG } from '../core/config.js';

let activeDayFilter = 'All';
let searchQuery = '';

document.addEventListener('DOMContentLoaded', () => {
  if (!Navigation.requireAuth('admin')) return;
  Header.render('Doctor Rosters & Capacity Limits');
  AdminSidebar.render();

  initControls();
  loadDoctorsTable();
});

function initControls() {
  const searchInput = document.getElementById('admin-doc-search');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      searchQuery = e.target.value.toLowerCase().trim();
      loadDoctorsTable();
    });
  }

  const dayTabs = document.getElementById('admin-day-tabs');
  if (dayTabs) {
    dayTabs.querySelectorAll('.tab-filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        dayTabs.querySelectorAll('.tab-filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        activeDayFilter = btn.dataset.day;
        loadDoctorsTable();
      });
    });
  }

  const btnAdd = document.getElementById('btn-add-doctor');
  if (btnAdd) {
    btnAdd.addEventListener('click', async () => {
      await openDoctorModal(null);
    });
  }

  // Handle Form Submission
  const form = document.getElementById('form-doctor');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const docId = document.getElementById('doc-id').value;
      const nameInput = document.getElementById('doc-name');
      const titleInput = document.getElementById('doc-title');
      const serviceSelect = document.getElementById('doc-service');
      const startTimeInput = document.getElementById('doc-start-time');
      const endTimeInput = document.getElementById('doc-end-time');
      const capacityInput = document.getElementById('doc-capacity');
      const roomInput = document.getElementById('doc-room');

      let isValid = true;
      if (!FormValidator.validateRequired(nameInput, 'Doctor Name')) isValid = false;
      if (!FormValidator.validateRequired(titleInput, 'Professional Title')) isValid = false;

      const selectedDays = Dropdown.getSelectedDays('doctor-day-selector-container');
      const daysError = document.getElementById('doc-days-error');
      if (selectedDays.length === 0) {
        if (daysError) {
          daysError.textContent = 'Select at least one duty working day.';
          daysError.style.display = 'block';
        }
        isValid = false;
      } else {
        if (daysError) daysError.style.display = 'none';
      }

      if (!startTimeInput.value || !endTimeInput.value || startTimeInput.value >= endTimeInput.value) { Toast.warning('End time must be after start time.'); isValid = false; }
      if (!Number.isInteger(Number(capacityInput.value)) || Number(capacityInput.value) < 1) { Toast.warning('Enter a positive whole number for daily capacity.'); isValid = false; }
      if (!isValid) return;

      const serviceOption = serviceSelect.options[serviceSelect.selectedIndex];

      const doctorData = {
        name: nameInput.value.trim(),
        title: titleInput.value.trim(),
        serviceId: serviceSelect.value,
        specialization: serviceOption.text,
        workingDays: selectedDays,
        startTime: startTimeInput.value,
        endTime: endTimeInput.value,
        dailyCapacity: parseInt(capacityInput.value, 10) || 25,
        room: roomInput.value.trim() || 'General Clinic',
        isAdminCreated: true
      };

      if (docId) {
        doctorData.id = docId;
      }

      await DoctorService.saveDoctor(doctorData);
      Modal.close('doctor-form-modal');
      Toast.success(docId ? 'Doctor schedule updated successfully!' : 'New physician added to clinic roster!');
      loadDoctorsTable();
    });
  }
}

async function loadDoctorsTable() {
  const tbody = document.getElementById('doctors-manage-tbody');
  if (!tbody) return;

  const doctors = await DoctorService.getFilteredDoctors({
    day: activeDayFilter,
    query: searchQuery
  });

  if (!doctors.length) {
    tbody.innerHTML = searchQuery || activeDayFilter !== 'All'
      ? '<div class="quiet-card"><h3>No matching doctors found</h3><p>Try another name or working day filter.</p></div>'
      : '<div class="quiet-card"><h3>No doctors added yet</h3><p>Click "Add New Physician" to set up clinic duty rosters.</p></div>';
    return;
  }
  tbody.innerHTML = doctors.map(doc => {
    const load = doctorLoad(doc);
    const status = attendanceStatus(doc);
    const percentage = Math.min(100, load / doc.dailyCapacity * 100);
    return `<article class="management-doctor"><div class="avatar">${Utils.escapeHtml(doc.name.replace(/^Dr\.?\s*/,'').slice(0,2))}</div><div class="management-name"><h3>${Utils.escapeHtml(doc.name)}</h3><p>${Utils.escapeHtml(doc.specialization)}</p></div><div><span>Working days</span><strong>${doc.workingDays.map(d=>d.slice(0,3)).join(', ')}</strong><small>${doc.startTime} – ${doc.endTime}</small></div><div><span>Daily capacity</span><strong>${load} / ${doc.dailyCapacity} patients</strong><div class="capacity-bar"><div class="capacity-fill" style="width:${percentage}%"></div></div></div><div><span class="badge badge-${statusTone(status)}">${status}</span>${load >= doc.dailyCapacity ? '<span class="badge badge-warning">Fully Booked</span>' : ''}<small>${Utils.escapeHtml(doc.room)}</small></div><div class="management-actions"><div style="display:flex; gap:6px; width:100%;"><button class="btn btn-outline-teal btn-sm" style="flex:1;" onclick="editDoctorSchedule('${doc.publicId || doc.id}')">Edit schedule</button><button type="button" class="btn btn-outline-danger btn-sm" title="Delete physician" onclick="deleteDoctorProfile('${doc.publicId || doc.id}', '${Utils.escapeHtml(doc.name)}')">Delete</button></div><label class="text-xs" for="status-${doc.id}">Attendance status</label><select class="form-control doctor-status-select" id="status-${doc.id}" data-doctor-id="${doc.id}" aria-label="Attendance status for ${Utils.escapeHtml(doc.name)}">${DOCTOR_STATUSES.map(value => '<option ' + (value === status ? 'selected' : '') + '>' + value + '</option>').join('')}</select>${status === 'Arriving Soon' && doc.expectedArrivalAt ? '<small>Expected at ' + new Date(doc.expectedArrivalAt).toLocaleTimeString('en-GB', {hour:'2-digit',minute:'2-digit'}) + '</small>' : ''}</div></article>`;
  }).join('');
  tbody.querySelectorAll('.doctor-status-select').forEach(select => select.addEventListener('change', () => {
    const id = select.dataset.doctorId;
    const status = select.value;
    const save = minutes => {
      try { saveDoctorStatus(id, status, minutes); Toast.success('Doctor attendance updated.'); loadDoctorsTable(); }
      catch (error) { Toast.error(error.message); loadDoctorsTable(); return false; }
    };
    if (status !== 'Arriving Soon') { save(); return; }
    // Do not persist an arrival state without its estimate.
    select.value = attendanceStatus(doctors.find(d => d.id === id));
    Modal.confirm({ title: 'Expected arrival', message: '<label class="form-label" for="doctor-arrival">Expected in</label><select class="form-control" id="doctor-arrival"><option value="15">15 minutes</option><option value="30">30 minutes</option><option value="45">45 minutes</option><option value="60">60 minutes</option></select><p class="text-xs text-muted">An estimate does not automatically mark the doctor available. Update attendance when they arrive.</p>', confirmText: 'Save arrival time', onConfirm: () => save(document.getElementById('doctor-arrival').value) });
  }));
}

async function openDoctorModal(doc = null) {
  const modalTitle = document.getElementById('doctor-modal-title');
  const docIdInput = document.getElementById('doc-id');
  const nameInput = document.getElementById('doc-name');
  const titleInput = document.getElementById('doc-title');
  const serviceSelect = document.getElementById('doc-service');
  const startTimeInput = document.getElementById('doc-start-time');
  const endTimeInput = document.getElementById('doc-end-time');
  const capacityInput = document.getElementById('doc-capacity');
  const roomInput = document.getElementById('doc-room');

  // Populate services dropdown
  let services = [];
  try {
    services = await MedicalService.getAllServices();
  } catch (err) {
    console.warn('[DoctorManagement] Failed to fetch services from MedicalService:', err);
  }
  if (!Array.isArray(services) || services.length === 0) {
    services = Storage.get(APP_CONFIG.STORAGE_KEYS.SERVICES, INITIAL_SERVICES) || INITIAL_SERVICES || [];
  }

  serviceSelect.innerHTML = services.map(s => {
    const sId = s.publicId || s.id;
    const isSelected = doc && (doc.serviceId === s.id || doc.serviceId === s.publicId);
    return `<option value="${sId}" ${isSelected ? 'selected' : ''}>${Utils.escapeHtml(s.name)}</option>`;
  }).join('');

  if (doc) {
    modalTitle.textContent = `Edit Schedule — ${Utils.escapeHtml(doc.name)}`;
    docIdInput.value = doc.id;
    nameInput.value = doc.name;
    titleInput.value = doc.title || '';
    startTimeInput.value = doc.startTime || '08:00';
    endTimeInput.value = doc.endTime || '16:00';
    capacityInput.value = doc.dailyCapacity || 25;
    roomInput.value = doc.room || '';
    Dropdown.setupDaySelector('doctor-day-selector-container', doc.workingDays || []);
  } else {
    modalTitle.textContent = 'Add New Physician to Roster';
    docIdInput.value = '';
    nameInput.value = '';
    titleInput.value = 'Medical Officer';
    startTimeInput.value = '08:00';
    endTimeInput.value = '16:00';
    capacityInput.value = '25';
    roomInput.value = 'Consulting Room';
    Dropdown.setupDaySelector('doctor-day-selector-container', ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']);
  }

  Modal.open('doctor-form-modal');
}

// Global actions
window.editDoctorSchedule = async (id) => {
  const doctors = await DoctorService.getAllDoctors();
  const doc = doctors.find(d => d.id === id);
  if (doc) await openDoctorModal(doc);
};

window.deleteDoctorProfile = (publicId, doctorName) => {
  const name = doctorName || 'this physician';
  Modal.confirm({
    title: 'Delete Physician',
    message: `
      <div style="text-align: left;">
        <p style="margin-bottom: var(--space-2); color: var(--color-text);">Are you sure you want to remove <strong>${Utils.escapeHtml(name)}</strong>?</p>
        <p class="text-xs text-secondary">The doctor will be excluded from new appointment bookings. Historical records will be preserved.</p>
      </div>
    `,
    confirmText: 'Delete Physician',
    cancelText: 'Cancel',
    confirmClass: 'btn-danger',
    onConfirm: async () => {
      try {
        await DoctorService.deleteDoctor(publicId);
        Toast.info(`${name} removed successfully.`);
        await loadDoctorsTable();
      } catch (err) {
        console.error('[AdminDoctors] Delete failed:', err);
        Toast.error(err.message || 'Failed to remove physician.');
      }
    }
  });
};

window.addEventListener('storage', event => { if ([APP_CONFIG.STORAGE_KEYS.DOCTORS, APP_CONFIG.STORAGE_KEYS.APPOINTMENTS].includes(event.key)) loadDoctorsTable(); });

export { openDoctorModal };
