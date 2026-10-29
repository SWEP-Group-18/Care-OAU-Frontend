import { openStaffAccount } from './staff-account.js';
import { Utils } from '../core/utils.js';
/**
 * Care-OAU - Top Header Component
 * Manages the top bar, breadcrumb/title, mobile drawer toggle, and user dropdown.
 */

import { Storage } from '../core/storage.js';
import { APP_CONFIG } from '../core/config.js';
import { Navigation } from '../core/navigation.js';
import { Dropdown } from '../components/dropdown.js';

export const Header = {
  render(title = 'Dashboard') {
    const headerContainer = document.querySelector('.top-header');
    if (!headerContainer) return;

    const user = Storage.get(APP_CONFIG.STORAGE_KEYS.AUTH_USER) || {
      name: 'OAU Student',
      role: 'student',
      matricNo: 'CSC/2021/045'
    };

    headerContainer.innerHTML = `
      <div class="header-left">
        <button class="mobile-menu-toggle" id="mobile-menu-toggle" aria-label="Toggle navigation menu">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="3" y1="12" x2="21" y2="12"></line>
            <line x1="3" y1="6" x2="21" y2="6"></line>
            <line x1="3" y1="18" x2="21" y2="18"></line>
          </svg>
        </button>
        <h1 class="page-title">${title}</h1>
      </div>

      <div class="header-right">
        <div class="dropdown">
          <button class="btn btn-ghost btn-sm" data-dropdown-toggle aria-label="Account menu" aria-expanded="false" aria-controls="account-menu" style="display: flex; align-items: center; gap: 8px;">
            <div class="user-avatar" style="width: 32px; height: 32px; font-size: 13px;">
              ${(user.name || 'U').charAt(0).toUpperCase()}
            </div>
            <span class="text-sm text-semibold header-user-name">
              ${Utils.escapeHtml(user.name)}
            </span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </button>

          <div class="dropdown-menu" id="account-menu">
            <div style="padding: 10px 16px; border-bottom: 1px solid var(--color-border); background: #f8fafc;">
              <div class="text-xs text-bold" style="font-weight: 700; color: #0B2459; font-size: 13px;">${Utils.escapeHtml(user.name)}</div>
              <div class="text-xs" style="color: #64748b; font-size: 11px; margin-top: 2px;">${Utils.escapeHtml(user.matricNo || user.staffId || user.email || '')}</div>
            </div>
            ${user.role === 'student' ? '<a href="profile.html" class="dropdown-item">View Profile</a><a href="profile.html#change-password" class="dropdown-item">Change Password</a>' : '<button type="button" class="dropdown-item" id="staff-view-profile">View Profile</button><button type="button" class="dropdown-item" id="staff-change-password">Change Password</button>'}
            <a href="#" class="dropdown-item" id="header-logout-btn">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                <polyline points="16 17 21 12 16 7"></polyline>
                <line x1="21" y1="12" x2="9" y2="12"></line>
              </svg>
              <span>Sign Out</span>
            </a>
          </div>
        </div>
      </div>
    `;

    headerContainer.querySelector('#staff-view-profile')?.addEventListener('click', () => openStaffAccount());
    headerContainer.querySelector('#staff-change-password')?.addEventListener('click', () => openStaffAccount({ password: true }));

    // Hook up logout
    const logoutBtn = headerContainer.querySelector('#header-logout-btn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', (e) => {
        e.preventDefault();
        Navigation.logout();
      });
    }

    // Initialize dropdown toggle behavior (user menu, etc.)
    Dropdown.init();
  }
};
