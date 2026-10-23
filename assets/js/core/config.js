/**
 * Care-OAU - Core Application Configuration
 * Configures API endpoints, storage keys, and environment variables.
 */

export const APP_CONFIG = {
  APP_NAME: 'Care-OAU',
  TAGLINE: 'Your Health. Your Time. Our Care.',
  VERSION: '1.0.0-scaffold',
  INSTITUTION: 'Obafemi Awolowo University Health Centre',
  
  // Future Node.js + Express backend endpoint
  API_BASE_URL: 'http://localhost:5000/api',
  
  // Toggle for frontend prototype simulation mode
  USE_MOCK_DATA: true,

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
