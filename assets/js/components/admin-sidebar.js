import { Utils } from '../core/utils.js';
/**
 * Care-OAU - Admin / Staff Sidebar Component
 * Matches Figma visual specifications, left navigation, collapse toggle, and mobile drawer.
 */

import { Storage } from '../core/storage.js';
import { APP_CONFIG } from '../core/config.js';
import { Navigation } from '../core/navigation.js';
import { MobileTabNav } from './mobile-tab-nav.js';

export const AdminSidebar = {
  render() {
    // Render mobile bottom tab bar
    MobileTabNav.render('admin');

    const sidebarEl = document.querySelector('.sidebar');
    if (!sidebarEl) return;

    // Desktop sidebar is always fixed full-width; ensure no collapsed class remains
    if (typeof document !== 'undefined' && document.body) {
      document.body.classList.remove('sidebar-collapsed');
    }

    const user = Storage.get(APP_CONFIG.STORAGE_KEYS.AUTH_USER) || {
      name: 'Dr. Adeleke',
      staffId: 'STAFF/MED/002',
      role: 'admin'
    };

    const initials = (user.name || 'DA')
      .split(' ')
      .map(n => n.charAt(0))
      .slice(0, 2)
      .join('')
      .toUpperCase();

    sidebarEl.innerHTML = `
      <div class="sidebar-top">
        <a href="dashboard.html" class="logo logo-inverse" style="text-decoration: none;">
          <span class="logo-mark">
            <img src="../assets/images/oau-logo.png" alt="Obafemi Awolowo University logo" class="brand-crest-img">
          </span>
          <span class="logo-text-wrap">
            <strong>Care-OAU</strong>
            <small>Hospital Staff Portal</small>
          </span>
        </a>
      </div>

      <div class="sidebar-section-label">Clinic Operations</div>

      <nav class="sidebar-nav">
        <a href="dashboard.html" class="sidebar-link" title="Staff Dashboard">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <rect width="7" height="9" x="3" y="3" rx="1"></rect>
            <rect width="7" height="5" x="14" y="3" rx="1"></rect>
            <rect width="7" height="9" x="14" y="12" rx="1"></rect>
            <rect width="7" height="5" x="3" y="16" rx="1"></rect>
          </svg>
          <span>Staff Dashboard</span>
        </a>

        <a href="appointments.html" class="sidebar-link" title="Appointments">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path>
            <rect width="8" height="4" x="8" y="2" rx="1" ry="1"></rect>
            <path d="m9 14 2 2 4-4"></path>
          </svg>
          <span>Appointments</span>
        </a>

        <a href="queue-management.html" class="sidebar-link" title="Queue Management">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <circle cx="12" cy="12" r="10"></circle>
            <polyline points="12 6 12 12 16 14"></polyline>
          </svg>
          <span>Queue Management</span>
        </a>

        <a href="doctor-management.html" class="sidebar-link" title="Doctor Scheduling">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <path d="M4.8 2.3A.3.3 0 1 0 5 2H4a2 2 0 0 0-2 2v5a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6V4a2 2 0 0 0-2-2h-1a.2.2 0 1 0 .3.3"></path>
            <path d="M8 15v1a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6v-4"></path>
            <circle cx="20" cy="10" r="2"></circle>
          </svg>
          <span>Doctor Scheduling</span>
        </a>

        <a href="service-management.html" class="sidebar-link" title="Service Management">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <circle cx="12" cy="12" r="3"></circle>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
          </svg>
          <span>Service Management</span>
        </a>
      </nav>

      <div class="sidebar-footer">
        <div class="sidebar-profile-card">
          <span class="avatar">${initials}</span>
          <span class="profile-name">
            <strong>${Utils.escapeHtml(user.name)}</strong>
            <small>${user.staffId || 'Staff'}</small>
          </span>
        </div>
        <a href="../student/dashboard.html" class="sidebar-action-btn" title="Return to Student Portal">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
          <span>Student Portal</span>
        </a>
        <button type="button" class="sidebar-action-btn" id="btn-sidebar-logout" title="Sign out">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
            <polyline points="16 17 21 12 16 7"></polyline>
            <line x1="21" y1="12" x2="9" y2="12"></line>
          </svg>
          <span>Sign out</span>
        </button>
      </div>
    `;

    this.bindEvents(sidebarEl);
    Navigation.highlightActiveLink();
  },

  bindEvents(sidebarEl) {
    // Logout handler
    const logoutBtn = sidebarEl.querySelector('#btn-sidebar-logout');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', (e) => {
        e.preventDefault();
        Navigation.logout();
      });
    }
  }
};
