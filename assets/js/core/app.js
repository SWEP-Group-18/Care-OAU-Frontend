/**
 * Care-OAU - Core Application Entry Point
 * Bootstraps base events, dropdown listeners, and shared prototypes.
 */

import { Dropdown } from '../components/dropdown.js';
import { Storage } from './storage.js';
import { APP_CONFIG } from './config.js';

export function initApp() {
  // Initialize Dropdowns
  Dropdown.init();

  // Apply stored sidebar collapsed preference on desktop
  const isCollapsed = Storage.get(APP_CONFIG.STORAGE_KEYS.SIDEBAR_COLLAPSED, false);
  if (isCollapsed) {
    document.body.classList.add('sidebar-collapsed');
  }

  // Ensure drawer backdrop exists for mobile
  if (!document.querySelector('.drawer-backdrop')) {
    const backdrop = document.createElement('div');
    backdrop.className = 'drawer-backdrop';
    document.body.appendChild(backdrop);
  }

  console.log(`Care-OAU initialized (${APP_CONFIG.VERSION})`);
}

// Self-init if loaded in standard page
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
  } else {
    initApp();
  }
}
