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

  // Desktop sidebar is always fixed full-width; clean up any legacy collapsed class
  if (typeof document !== 'undefined' && document.body) {
    document.body.classList.remove('sidebar-collapsed');
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
