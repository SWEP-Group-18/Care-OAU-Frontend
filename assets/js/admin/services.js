import { Utils } from '../core/utils.js';
import { Navigation } from '../core/navigation.js';
/**
 * Care-OAU - Admin Service Management Logic
 * Handles medical services configuration, Monday-Sunday multi-select days,
 * referral requirements, and capacity controls.
 */

import { MedicalService } from '../services/medical-service.js';
import { AdminSidebar } from '../components/admin-sidebar.js';
import { Header } from '../components/header.js';
import { Modal } from '../components/modal.js';
import { Toast } from '../components/toast.js';
import { Dropdown } from '../components/dropdown.js';
import { FormValidator } from '../components/form-validation.js';

document.addEventListener('DOMContentLoaded', () => {
  if (!Navigation.requireAuth('admin')) return;
  Header.render('Medical Service Configuration');
  AdminSidebar.render();

  initControls();
  loadServicesTable();
});

function initControls() {
  const btnAdd = document.getElementById('btn-add-service');
  if (btnAdd) {
    btnAdd.addEventListener('click', () => {
      openServiceModal(null);
    });
  }

  const form = document.getElementById('form-service');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const serviceId = document.getElementById('service-id').value;
      const nameInput = document.getElementById('service-name');
      const categorySelect = document.getElementById('service-category');
      const descInput = document.getElementById('service-description');
      const startTimeInput = document.getElementById('service-start-time');
      const endTimeInput = document.getElementById('service-end-time');
      const capacityInput = document.getElementById('service-capacity');
      const referralCheck = document.getElementById('service-referral');

      let isValid = true;
      if (!FormValidator.validateRequired(nameInput, 'Service Title')) isValid = false;
      if (!FormValidator.validateRequired(descInput, 'Description')) isValid = false;

      // Monday-Sunday multi-select validation
      const selectedDays = Dropdown.getSelectedDays('service-day-selector-container');
      const daysError = document.getElementById('service-days-error');
      if (selectedDays.length === 0) {
        if (daysError) {
          daysError.textContent = 'Please select at least one active operating day (Monday–Sunday).';
          daysError.style.display = 'block';
        }
        isValid = false;
      } else {
        if (daysError) daysError.style.display = 'none';
      }

      if (!startTimeInput.value || !endTimeInput.value || startTimeInput.value >= endTimeInput.value) { Toast.warning('End time must be after start time.'); isValid = false; }
      if (!Number.isInteger(Number(capacityInput.value)) || Number(capacityInput.value) < 1) { Toast.warning('Enter a positive whole number for daily capacity.'); isValid = false; }
      if (!isValid) return;

      const serviceData = {
        name: nameInput.value.trim(),
        category: categorySelect.value,
        description: descInput.value.trim(),
        operatingDays: selectedDays,
        startTime: startTimeInput.value,
        endTime: endTimeInput.value,
        dailyCapacity: parseInt(capacityInput.value, 10) || 50,
        requiresReferral: referralCheck.checked
      };

      if (serviceId) {
        serviceData.id = serviceId;
      }

      await MedicalService.saveService(serviceData);
      Modal.close('service-form-modal');
      Toast.success(serviceId ? 'Service configuration updated!' : 'New medical service created successfully!');
      loadServicesTable();
    });
  }
}

async function loadServicesTable() {
  const tbody = document.getElementById('services-tbody');
  if (!tbody) return;

  const services = await MedicalService.getAllServices();

  tbody.innerHTML = services.map(srv => `<article>
    <div class="service-card-head"><span class="service-icon" aria-hidden="true">&#10010;</span><span class="badge ${srv.isActive ? 'badge-success' : 'badge-neutral'}">${srv.isActive ? 'Open for booking' : 'Temporarily closed'}</span></div>
    <h2>${Utils.escapeHtml(srv.name)}</h2><p>${Utils.escapeHtml(srv.description)}</p>
    <dl><div><dt>Operating days</dt><dd>${(srv.operatingDays || []).map(d => d.slice(0,3)).join(', ')}</dd></div><div><dt>Service hours</dt><dd>${srv.startTime}  -  ${srv.endTime}</dd></div><div><dt>Daily capacity</dt><dd>${srv.dailyCapacity} patients</dd></div><div><dt>Referral</dt><dd>${srv.requiresReferral ? 'Required' : 'Not required'}</dd></div></dl>
    <div class="service-card-actions"><button class="btn btn-outline-teal" onclick="editMedicalService('${srv.id}')">Edit service</button><button class="btn btn-ghost" onclick="toggleServiceActiveStatus('${srv.id}')">${srv.isActive ? 'Close bookings' : 'Open bookings'}</button></div>
  </article>`).join('');
}

function openServiceModal(srv = null) {
  const modalTitle = document.getElementById('service-modal-title');
  const idInput = document.getElementById('service-id');
  const nameInput = document.getElementById('service-name');
  const categorySelect = document.getElementById('service-category');
  const descInput = document.getElementById('service-description');
  const startTimeInput = document.getElementById('service-start-time');
  const endTimeInput = document.getElementById('service-end-time');
  const capacityInput = document.getElementById('service-capacity');
  const referralCheck = document.getElementById('service-referral');

  if (srv) {
    modalTitle.textContent = `Edit Service — ${srv.name}`;
    idInput.value = srv.id;
    nameInput.value = srv.name;
    categorySelect.value = srv.category || 'General Outpatient';
    descInput.value = srv.description || '';
    startTimeInput.value = srv.startTime || '08:00';
    endTimeInput.value = srv.endTime || '18:00';
    capacityInput.value = srv.dailyCapacity || 50;
    referralCheck.checked = !!srv.requiresReferral;
    Dropdown.setupDaySelector('service-day-selector-container', srv.operatingDays || []);
  } else {
    modalTitle.textContent = 'Add New Clinical Service';
    idInput.value = '';
    nameInput.value = '';
    categorySelect.value = 'General Outpatient';
    descInput.value = '';
    startTimeInput.value = '08:00';
    endTimeInput.value = '18:00';
    capacityInput.value = '50';
    referralCheck.checked = false;
    Dropdown.setupDaySelector('service-day-selector-container', ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']);
  }

  Modal.open('service-form-modal');
}

// Global actions
window.editMedicalService = async (id) => {
  const services = await MedicalService.getAllServices();
  const srv = services.find(s => s.id === id);
  if (srv) openServiceModal(srv);
};

window.toggleServiceActiveStatus = async (id) => {
  await MedicalService.toggleStatus(id);
  Toast.info('Service status updated.');
  loadServicesTable();
};
