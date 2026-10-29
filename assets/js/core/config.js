/**
 * Care-OAU - Core Application Configuration
 * Configures API endpoints, storage keys, and environment variables.
 */

const PRODUCTION_API_ORIGIN = 'https://care-oau-api.onrender.com';
const LOCAL_API_ORIGIN = 'http://localhost:5000';

/**
 * Normalizes an API base URL ensuring no trailing slashes and a standard /api/v1 prefix.
 */
function normalizeApiBaseUrl(raw) {
  if (!raw || typeof raw !== 'string') return '';
  let url = raw.trim().replace(/\/+$/, '');
  if (!url) return '';
  if (url.endsWith('/api/v1')) return url;
  if (url.endsWith('/api')) return `${url}/v1`;
  return `${url}/api/v1`;
}

/**
 * Resolves the active API base URL.
 * Order of precedence:
 * 1. window.__CARE_OAU_API_URL__ (if explicitly provided via script or window injection)
 * 2. On Vercel (*.vercel.app): '/api/v1' (leveraging vercel.json rewrite proxy to bypass cross-origin cookie restrictions)
 * 3. On localhost / 127.0.0.1: 'http://localhost:5000/api/v1'
 * 4. Production fallback: 'https://care-oau-api.onrender.com/api/v1'
 */
function resolveApiBaseUrl() {
  if (typeof window !== 'undefined' && window.__CARE_OAU_API_URL__) {
    return normalizeApiBaseUrl(window.__CARE_OAU_API_URL__);
  }

  if (typeof window !== 'undefined' && window.location) {
    const hostname = window.location.hostname;
    const isLocal = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '';
    if (isLocal) {
      return normalizeApiBaseUrl(LOCAL_API_ORIGIN);
    }
    if (hostname.endsWith('vercel.app')) {
      return '/api/v1';
    }
  }

  return normalizeApiBaseUrl(PRODUCTION_API_ORIGIN);
}

/**
 * Determines whether to use mock data fallback.
 * Strictly defaults to false in all environments (production & local) to ensure real API usage.
 * Can only be explicitly enabled in isolated test suites via window.__CARE_OAU_USE_MOCK__.
 */
function resolveUseMock() {
  if (typeof window !== 'undefined' && typeof window.__CARE_OAU_USE_MOCK__ === 'boolean') {
    return window.__CARE_OAU_USE_MOCK__;
  }
  return false;
}

export const APP_CONFIG = {
  APP_NAME: 'Care-OAU',
  TAGLINE: 'Your Health. Your Time. Our Care.',
  VERSION: '1.0.0-scaffold',
  INSTITUTION: 'Obafemi Awolowo University Health Centre',
  
  // Emergency Helpline & Direct WhatsApp Contacts
  EMERGENCY: {
    PHONE: '+2348033944854',
    PHONE_DISPLAY: '0803 394 4854',
    WHATSAPP: '2348033944854',
    WHATSAPP_DISPLAY: '+234 803 394 4854',
    MESSAGE: 'Hello Care-OAU Emergency Unit, I need urgent medical assistance.'
  },
  
  // Dynamic resolution for backend API endpoint
  get API_BASE_URL() {
    return resolveApiBaseUrl();
  },
  set API_BASE_URL(val) {
    if (typeof window !== 'undefined') {
      window.__CARE_OAU_API_URL__ = val;
    }
  },
  
  // Toggle for frontend prototype simulation mode (false in production)
  get USE_MOCK_DATA() {
    return resolveUseMock();
  },
  set USE_MOCK_DATA(val) {
    if (typeof window !== 'undefined') {
      window.__CARE_OAU_USE_MOCK__ = Boolean(val);
    }
  },

  // Storage Keys for Browser Storage (Prototype demonstration only)
  STORAGE_KEYS: {
    AUTH_USER: 'care_oau_auth_user',
    AUTH_TOKEN: 'care_oau_auth_token',
    APPOINTMENTS: 'care_oau_appointments',
    DOCTORS: 'care_oau_doctors',
    SERVICES: 'care_oau_services',
    QUEUE: 'care_oau_queue',
    CURRENT_QUEUE_CALL: 'care_oau_current_queue_call',
    SIDEBAR_COLLAPSED: 'care_oau_sidebar_collapsed',
    VERIFICATION_PENDING: 'care_oau_pending_verification'
  },

  // Appointment Status Definitions
  APPOINTMENT_STATUS: {
    PENDING: 'Pending Approval',
    APPROVED: 'Approved',
    REJECTED: 'Rejected',
    CHECKED_IN: 'Checked In',
    IN_CONSULTATION: 'In Consultation',
    COMPLETED: 'Completed',
    CANCELLED: 'Cancelled'
  },

  // Queue Status Definitions
  QUEUE_STATUS: {
    WAITING: 'Waiting',
    CALLED: 'Called',
    IN_CONSULTATION: 'In Consultation',
    COMPLETED: 'Completed',
    NO_SHOW: 'No Show'
  }
};
