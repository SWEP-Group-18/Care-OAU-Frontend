/**
 * Care-OAU - Modal Dialog Controller
 * Manages modal display, backdrop dismiss, keyboard navigation and confirmation dialogs.
 */

import { Utils } from '../core/utils.js';

export const Modal = {
  /**
   * Open a modal by ID or element
   */
  open(modalId) {
    const backdrop = typeof modalId === 'string' 
      ? document.getElementById(modalId) 
      : modalId;
      
    if (!backdrop) {
      console.warn(`Modal element not found: ${modalId}`);
      return;
    }

    this.previousFocus = document.activeElement;
    backdrop.classList.add('active');
    document.body.style.overflow = 'hidden';

    // Focus the first focusable element inside the modal
    const focusable = backdrop.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    if (focusable) focusable.focus();

    // Setup dismiss listeners
    this.bindEvents(backdrop);
  },

  /**
   * Close an open modal
   */
  close(modalId) {
    const backdrop = typeof modalId === 'string' 
      ? document.getElementById(modalId) 
      : modalId;

    if (!backdrop) return;

    backdrop.classList.remove('active');
    if (backdrop.keyHandler) document.removeEventListener('keydown', backdrop.keyHandler);
    this.previousFocus?.focus();
    
    // Only restore body scroll if no other active modal exists
    if (!document.querySelector('.modal-backdrop.active')) {
      document.body.style.overflow = '';
    }
  },

  /**
   * Close all active modals
   */
  closeAll() {
    document.querySelectorAll('.modal-backdrop.active').forEach(backdrop => {
      backdrop.classList.remove('active');
    });
    document.body.style.overflow = '';
  },

  /**
   * Helper to show a generic confirmation dialog
   */
  confirm({
    title = 'Confirm Action',
    message = 'Are you sure you want to proceed?',
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    confirmClass = 'btn-teal',
    onConfirm = () => {}
  }) {
    let confirmModal = document.getElementById('global-confirm-modal');
    if (!confirmModal) {
      confirmModal = document.createElement('div');
      confirmModal.id = 'global-confirm-modal';
      confirmModal.className = 'modal-backdrop';
      document.body.appendChild(confirmModal);
    }

    confirmModal.innerHTML = `
      <div class="modal" role="dialog" aria-modal="true">
        <div class="modal-header">
          <h3 class="modal-title">${Utils.escapeHtml(title)}</h3>
          <button class="modal-close" aria-label="Close dialog" data-modal-close>&times;</button>
        </div>
        <div class="modal-body">
          <div>${message}</div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-ghost" data-modal-close>${cancelText}</button>
          <button type="button" class="btn ${confirmClass}" id="confirm-modal-action-btn">${confirmText}</button>
        </div>
      </div>
    `;

    const confirmBtn = confirmModal.querySelector('#confirm-modal-action-btn');
    confirmBtn.onclick = async () => {
      confirmBtn.disabled = true;
      try {
        const result = typeof onConfirm === 'function' ? await onConfirm() : undefined;
        if (result !== false) this.close(confirmModal);
      } finally { confirmBtn.disabled = false; }
    };

    this.open(confirmModal);
  },

  bindEvents(backdrop) {
    // Backdrop click
    backdrop.onclick = (e) => {
      if (e.target === backdrop) {
        this.close(backdrop);
      }
    };

    // Close buttons inside modal
    backdrop.querySelectorAll('[data-modal-close]').forEach(btn => {
      btn.onclick = () => this.close(backdrop);
    });

    // ESC key
    const onKeydown = (e) => {
      if (e.key === 'Tab' && backdrop.classList.contains('active')) {
        const items = [...backdrop.querySelectorAll('button, a[href], input, select, textarea, [tabindex="0"]')].filter(el => !el.disabled && el.offsetParent);
        const first = items[0], last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
      }
      if (e.key === 'Escape' && backdrop.classList.contains('active')) {
        this.close(backdrop);
        document.removeEventListener('keydown', onKeydown);
      }
    };
    if (backdrop.keyHandler) document.removeEventListener('keydown', backdrop.keyHandler);
    backdrop.keyHandler = onKeydown;
    document.addEventListener('keydown', onKeydown);
  }
};
