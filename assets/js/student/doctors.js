import { Utils } from '../core/utils.js';
import { availableSlots, localDate } from '../services/availability.js';
import { Navigation } from '../core/navigation.js';
/**
 * Care-OAU - Doctor Availability Page Logic (Figma Aligned)
 * Computes schedule-derived doctor availability, handles specialty/date filters,
 * and links directly to the booking workflow.
 */

import { Storage } from '../core/storage.js';
import { APP_CONFIG } from '../core/config.js';
import { StudentSidebar } from '../components/student-sidebar.js';
import { Header } from '../components/header.js';
import { INITIAL_DOCTORS } from '../data/mock-data.js';

let specialtyFilter = 'All';
let selectedDateStr = localDate();

document.addEventListener('DOMContentLoaded', () => {
  if (!Navigation.requireAuth('student')) return;
  Header.render('Doctor Availability');
  StudentSidebar.render();

  // Seed doctors in storage if empty
  if (!Storage.get(APP_CONFIG.STORAGE_KEYS.DOCTORS)) {
    Storage.set(APP_CONFIG.STORAGE_KEYS.DOCTORS, INITIAL_DOCTORS);
  }

  // Initialize date input default to today
  const dateInput = document.getElementById('filter-date');
  if (dateInput) {
    dateInput.value = selectedDateStr;
    dateInput.min = localDate();
    dateInput.addEventListener('change', (e) => {
      selectedDateStr = e.target.value;
      renderDoctorList();
    });
  }

  const specialtySelect = document.getElementById('filter-specialty');
  if (specialtySelect) {
    const specialties = [...new Set(Storage.get(APP_CONFIG.STORAGE_KEYS.DOCTORS, []).map(d => d.specialization))];
    specialtySelect.replaceChildren(new Option('All specialties', 'All'), ...specialties.map(s => new Option(s, s)));
    specialtySelect.addEventListener('change', (e) => {
      specialtyFilter = e.target.value;
      renderDoctorList();
    });
  }

  renderDoctorList();
});

function renderDoctorList() {
  const container = document.getElementById('doctor-list');
  const countBadge = document.getElementById('doctors-on-duty-count');
  if (!container) return;

  const doctors = Storage.get(APP_CONFIG.STORAGE_KEYS.DOCTORS, []);

  // Determine selected day of week name
  const targetDate = new Date(selectedDateStr + 'T12:00:00');
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const targetDay = isNaN(targetDate.getTime()) ? dayNames[new Date().getDay()] : dayNames[targetDate.getDay()];

  // Filter by specialty
  let filtered = doctors;
  if (specialtyFilter !== 'All') {
    filtered = filtered.filter(
      (d) => (d.specialization || d.specialty || '').toLowerCase().includes(specialtyFilter.toLowerCase())
    );
  }

  // Calculate duty count
  const onDutyCount = filtered.filter(
    (d) => (d.workingDays || []).includes(targetDay) && d.isAvailable
  ).length;

  if (countBadge) {
    countBadge.textContent = `${onDutyCount} doctors on duty`;
  }

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="quiet-icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
        </div>
        <h3>No doctors found</h3>
        <p>No medical officers match the chosen specialty for this day.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = filtered.map((doc, idx) => {
    // Initials for avatar
    const parts = (doc.name || 'Doctor').replace(/^Dr\.?\s+/i, '').split(' ');
    const initials = parts.map((p) => p[0]).slice(0, 2).join('').toUpperCase();

    // Schedule-derived status
    const worksOnSelectedDay = (doc.workingDays || []).includes(targetDay);
    const capacity = doc.dailyCapacity || 25;
    const currentLoad = doc.currentLoad || 0;
    const isFull = currentLoad >= capacity;

    let status = 'Available';
    let badgeClass = 'badge-success';
    let nextAvailable = 'Today, 10:30 AM';
    let isAvailableNow = true;

    if (!worksOnSelectedDay || !doc.isAvailable) {
      status = 'Off Duty';
      badgeClass = 'badge-neutral';
      nextAvailable = 'Next shift: Friday, 8:30 AM';
      isAvailableNow = false;
    } else if (isFull) {
      status = 'Fully Booked';
      badgeClass = 'badge-warning';
      nextAvailable = 'Tomorrow, 8:30 AM';
      isAvailableNow = false;
    } else if (doc.status === 'In Consultation') {
      // Simulate real shift status
      status = 'In Consultation';
      badgeClass = 'badge-info';
      nextAvailable = 'Today, 11:15 AM';
      isAvailableNow = true;
    }

    const slots = availableSlots(doc.serviceId, doc.id, selectedDateStr);
    isAvailableNow = slots.length > 0;
    nextAvailable = slots[0]?.time || 'Select a future date';
    if (!slots.length && worksOnSelectedDay && doc.isAvailable) { status = 'No slots available'; badgeClass = 'badge-warning'; }
    const workingHoursText = doc.workingHours || `${doc.startTime || '8:00 AM'} – ${doc.endTime || '4:00 PM'}`;
    const specialization = doc.specialization || doc.specialty || 'General Medicine';

    return `
      <article class="doctor-card">
        <div class="doctor-avatar">${initials}</div>
        <div class="doctor-identity">
          <h3>${Utils.escapeHtml(doc.name)}</h3>
          <p>${specialization}</p>
        </div>
        <div class="doctor-detail">
          <span>Status</span>
          <span class="badge ${badgeClass}">
            <span class="badge-dot"></span>
            ${status}
          </span>
        </div>
        <div class="doctor-detail">
          <span>Working hours</span>
          <strong>${workingHoursText}</strong>
        </div>
        <div class="doctor-detail">
          <span>Next available</span>
          <strong>${nextAvailable}</strong>
        </div>
        <a href="book-appointment.html?doctorId=${doc.id}&date=${selectedDateStr}" class="button ${isAvailableNow ? 'button-primary' : 'button-secondary'}">
          ${isAvailableNow ? 'Book this doctor' : 'View future times'}
        </a>
      </article>
    `;
  }).join('');
}
