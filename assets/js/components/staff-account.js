import { Storage } from '../core/storage.js';
import { APP_CONFIG } from '../core/config.js';
import { Navigation } from '../core/navigation.js';
import { Utils } from '../core/utils.js';
import { Modal } from './modal.js';
import { passwordFormMarkup, bindPasswordForm } from './password-form.js';

export function openStaffAccount({ password = false } = {}) {
  const user = Storage.get(APP_CONFIG.STORAGE_KEYS.AUTH_USER);
  if (user?.role !== 'admin') return;
  if (!document.getElementById('staff-profile-styles')) {
    const stylesheet = document.createElement('link');
    stylesheet.id = 'staff-profile-styles'; stylesheet.rel = 'stylesheet';
    stylesheet.href = new URL('../../css/pages/staff-profile.css', import.meta.url).href;
    document.head.appendChild(stylesheet);
  }
  const accountToggle = document.querySelector('[data-dropdown-toggle]');
  accountToggle?.closest('.dropdown').classList.remove('open');
  accountToggle?.setAttribute('aria-expanded', 'false');
  let backdrop = document.getElementById('staff-profile-modal');
  if (!backdrop) {
    backdrop = document.createElement('div'); backdrop.id = 'staff-profile-modal';
    backdrop.className = 'modal-backdrop'; document.body.appendChild(backdrop);
  }
  const escape = value => Utils.escapeHtml(String(value || 'Not provided'));
  const initials = (user.name || 'Staff').split(/\s+/).filter(Boolean).map(part => part[0]).slice(0, 2).join('').toUpperCase();
  backdrop.innerHTML = `<section class="modal staff-account-panel" role="dialog" aria-modal="true" aria-labelledby="staff-profile-title">
    <div class="modal-header"><h2 class="modal-title" id="staff-profile-title">Staff Profile</h2><button type="button" class="modal-close" data-modal-close aria-label="Close staff profile">&times;</button></div>
    <div class="modal-body">
      <div class="staff-account-identity"><span class="staff-account-avatar" aria-hidden="true">${escape(initials)}</span><div><h3>${escape(user.name)}</h3><p>Health centre staff portal</p></div></div>
      <dl class="staff-account-details"><div><dt>Full name</dt><dd>${escape(user.name)}</dd></div><div><dt>Staff ID</dt><dd>${escape(user.staffId)}</dd></div><div><dt>Staff role</dt><dd>${escape(user.staffRole || 'Clinic administrator')}</dd></div></dl>
      <details id="staff-password-section" ${password ? 'open' : ''}><summary>Change Password</summary>${passwordFormMarkup('staff-password')}</details>
    </div>
    <div class="modal-footer"><button type="button" class="btn btn-ghost" data-modal-close>Close</button><button type="button" class="btn btn-outline-danger" id="staff-profile-signout">Sign Out</button></div>
  </section>`;
  bindPasswordForm('staff-password');
  document.getElementById('staff-profile-signout').onclick = () => Navigation.logout();
  Modal.open(backdrop);
  if (password) document.getElementById('staff-password-current').focus();
}
