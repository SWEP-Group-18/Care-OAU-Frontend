/**
 * Care-OAU - Floating Emergency Alert Widget Component
 * Bottom-right floating animated SOS trigger with flyout card for 1-click calling & WhatsApp dispatch.
 * Automatically pops up for 5 seconds on student login.
 */

import { APP_CONFIG } from '../core/config.js';

export const EmergencyWidget = {
  autoCloseTimer: null,

  /**
   * Generates the HTML string for the floating emergency alert widget
   */
  getHtml() {
    const config = APP_CONFIG.EMERGENCY || {
      PHONE: '+2348033944854',
      PHONE_DISPLAY: '0803 394 4854',
      WHATSAPP: '2348033944854',
      WHATSAPP_DISPLAY: '+234 803 394 4854',
      MESSAGE: 'Hello Care-OAU Emergency Unit, I need urgent medical assistance.'
    };
    const phone = config.PHONE;
    const phoneDisplay = config.PHONE_DISPLAY;
    const waNumber = config.WHATSAPP;
    const waMsg = encodeURIComponent(config.MESSAGE);
    const waUrl = `https://wa.me/${waNumber}?text=${waMsg}`;

    return `
      <aside class="floating-emergency-widget" id="floating-emergency-widget" aria-label="Campus Medical Emergency Hotline">
        <!-- Floating Animated Emergency Trigger Badge -->
        <button type="button" class="emergency-fab-trigger" id="emergency-fab-trigger" aria-label="Open 24/7 Campus Medical Emergency Hotline" aria-expanded="false" aria-controls="emergency-flyout-card" title="Campus Medical Emergency (24/7)">
          <span class="emergency-fab-pulse" aria-hidden="true"></span>
          <span class="emergency-fab-pulse-outer" aria-hidden="true"></span>
          <svg class="emergency-fab-icon" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
          </svg>
          <span class="emergency-fab-badge-text">SOS</span>
        </button>

        <!-- Flyout Emergency Contacts Card -->
        <div class="emergency-flyout-card" id="emergency-flyout-card" role="dialog" aria-modal="false" aria-labelledby="emergency-flyout-title">
          <div class="emergency-flyout-header">
            <div class="emergency-flyout-title-wrap">
              <div class="emergency-card-pulse-icon" aria-hidden="true">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
                </svg>
              </div>
              <div>
                <h4 class="emergency-flyout-title" id="emergency-flyout-title">Medical Emergency (24/7)</h4>
                <span class="emergency-flyout-subtitle">OAU Health Centre Emergency Unit</span>
              </div>
            </div>
            <button type="button" class="emergency-flyout-close" id="emergency-flyout-close" aria-label="Close emergency info" title="Close">&times;</button>
          </div>

          <p class="emergency-flyout-text">
            Experiencing acute trauma, asthma crisis, or urgent medical distress? Do not wait. Call our campus response unit directly or message on WhatsApp:
          </p>

          <div class="emergency-flyout-actions">
            <a href="tel:${phone}" class="emergency-btn emergency-btn-call" id="emergency-call-btn" title="Call Emergency Dispatch Directly">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
              </svg>
              <span>Call ${phoneDisplay}</span>
            </a>
            <a href="${waUrl}" target="_blank" rel="noopener noreferrer" class="emergency-btn emergency-btn-wa" id="emergency-wa-btn" title="Chat with Health Centre on WhatsApp">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/>
              </svg>
              <span>WhatsApp Dispatch</span>
            </a>
          </div>
        </div>
      </aside>
    `;
  },

  /**
   * Mounts the floating emergency widget directly to document.body
   */
  mount() {
    if (typeof document === 'undefined') return;
    if (document.getElementById('floating-emergency-widget')) return;

    const wrapper = document.createElement('div');
    wrapper.innerHTML = this.getHtml().trim();
    const widgetEl = wrapper.firstElementChild;
    if (!widgetEl) return;

    document.body.appendChild(widgetEl);

    const triggerBtn = widgetEl.querySelector('#emergency-fab-trigger');
    const flyoutCard = widgetEl.querySelector('#emergency-flyout-card');
    const closeBtn = widgetEl.querySelector('#emergency-flyout-close');

    const openFlyout = () => {
      flyoutCard?.classList.add('open');
      triggerBtn?.setAttribute('aria-expanded', 'true');
    };

    const closeFlyout = () => {
      flyoutCard?.classList.remove('open');
      triggerBtn?.setAttribute('aria-expanded', 'false');
      if (this.autoCloseTimer) {
        clearTimeout(this.autoCloseTimer);
        this.autoCloseTimer = null;
      }
    };

    triggerBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (flyoutCard?.classList.contains('open')) {
        closeFlyout();
      } else {
        openFlyout();
      }
    });

    closeBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      closeFlyout();
    });

    // Auto popup for 5 seconds on student login / first session arrival
    const POPUP_STORAGE_KEY = 'care_oau_emergency_popup_shown';
    try {
      const alreadyShown = sessionStorage.getItem(POPUP_STORAGE_KEY);
      if (!alreadyShown) {
        sessionStorage.setItem(POPUP_STORAGE_KEY, '1');
        openFlyout();
        this.autoCloseTimer = setTimeout(() => {
          closeFlyout();
        }, 5000);
      }
    } catch (_) {
      // Storage access protected in some iframe/sandbox environments
    }
  }
};
