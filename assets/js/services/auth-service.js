/**
 * Care-OAU - Authentication Service
 * Manages user authentication, session state, and simulated registration/verification flows.
 * DEMO NOTICE: In this prototype scaffold, authentication is simulated.
 * Do not enter real sensitive passwords or health credentials.
 */

import { Storage } from '../core/storage.js';
import { APP_CONFIG } from '../core/config.js';
import { Api } from './api-client.js';

/**
 * Normalizes user data returned by backend or storage into a consistent frontend user profile.
 */
function normalizeUser(rawUser, fallback = {}) {
  if (!rawUser || typeof rawUser !== 'object') return null;
  return {
    id: rawUser.id || rawUser.publicId || rawUser._id || fallback.id || `usr_${Date.now()}`,
    name: rawUser.name || rawUser.fullName || fallback.name || 'Student',
    email: rawUser.email || fallback.email || '',
    matricNo: rawUser.matricNumber || rawUser.matricNo || fallback.matricNo || '',
    phone: rawUser.phone || fallback.phone || '',
    role: rawUser.role || fallback.role || 'student',
    isVerified: rawUser.emailVerified ?? rawUser.isVerified ?? true
  };
}

export const AuthService = {
  /**
   * Log in a student using Email and Password against backend POST /api/v1/auth/login.
   * Fallback for mock mode allows demo identifiers for automated testing.
   */
  async loginStudent({ identifier, password, remember = false }) {
    const isEmail = identifier.includes('@');

    // In prototype mock mode, allow simulated accounts
    if (APP_CONFIG.USE_MOCK_DATA) {
      await new Promise(r => setTimeout(r, 300));
      const demoUser = {
        id: identifier.trim().toUpperCase() === '21/SCI/1048' ? 'usr_student_amina' : 'usr_student_01',
        name: identifier.trim().toUpperCase() === '21/SCI/1048' ? 'Amina Yusuf' : 'Oluwaseun Adeleke',
        matricNo: identifier.toUpperCase().includes('/') ? identifier.toUpperCase() : 'CSC/2021/045',
        email: isEmail ? identifier.toLowerCase().trim() : 'oadeleke@student.oauife.edu.ng',
        phone: '08123456789',
        role: 'student',
        isVerified: true
      };

      const accounts = Storage.get('care_oau_demo_accounts', []);
      const account = accounts.find(a => a.matricNo.toLowerCase() === identifier.trim().toLowerCase() || a.email.toLowerCase() === identifier.trim().toLowerCase());
      if (account) Object.assign(demoUser, account);
      else if (!['CSC/2021/045', '21/SCI/1048', 'OADELEKE@STUDENT.OAUIFE.EDU.NG'].includes(identifier.trim().toUpperCase())) {
        demoUser.id = `usr_demo_${identifier.trim().toLowerCase()}`;
        demoUser.name = 'Demo Student';
      }
      Storage.set(APP_CONFIG.STORAGE_KEYS.AUTH_USER, demoUser);
      return { success: true, user: demoUser };
    }

    // Live backend requires email format
    if (!isEmail) {
      return {
        success: false,
        message: 'Student login requires your registered email address (e.g. name@student.oauife.edu.ng).'
      };
    }

    try {
      const res = await Api.post('/auth/login', {
        email: identifier.trim().toLowerCase(),
        password
      });

      const rawUser = res.data?.user || res.data || {};
      const user = normalizeUser(rawUser, { email: identifier.trim().toLowerCase() });
      Storage.set(APP_CONFIG.STORAGE_KEYS.AUTH_USER, user);
      return { success: true, user, message: res.message || 'Login successful.' };
    } catch (error) {
      return {
        success: false,
        message: error.message || 'Login failed. Please check your credentials.',
        code: error.code,
        details: error.details || []
      };
    }
  },

  /**
   * Register a new student account via backend POST /api/v1/auth/register
   */
  async registerStudent({ fullName, matricNo, email, phone, password }) {
    const pendingUser = {
      id: `usr_${Date.now()}`,
      name: fullName.trim(),
      matricNo: matricNo.trim().toUpperCase(),
      email: email.trim().toLowerCase(),
      phone: phone.trim(),
      role: 'student',
      isVerified: false,
      verificationCode: '123456'
    };

    if (APP_CONFIG.USE_MOCK_DATA) {
      await new Promise(r => setTimeout(r, 400));
      Storage.set(APP_CONFIG.STORAGE_KEYS.VERIFICATION_PENDING, pendingUser);
      return { 
        success: true, 
        message: 'Account created! Please verify your student email.', 
        user: pendingUser 
      };
    }

    try {
      const res = await Api.post('/auth/register', {
        name: fullName.trim(),
        matricNumber: matricNo.trim().toUpperCase(),
        email: email.trim().toLowerCase(),
        phone: phone.trim(),
        password
      });

      const rawUser = res.data?.user || pendingUser;
      const user = normalizeUser(rawUser, pendingUser);
      user.isVerified = false;
      Storage.set(APP_CONFIG.STORAGE_KEYS.VERIFICATION_PENDING, user);

      return {
        success: true,
        message: res.message || 'Account created! Please verify your student email.',
        user
      };
    } catch (error) {
      return {
        success: false,
        message: error.message || 'Registration failed.',
        code: error.code,
        details: error.details || []
      };
    }
  },

  /**
   * Verify student email via 6-digit OTP via backend POST /api/v1/auth/verify-email
   */
  async verifyEmail(code, emailOverride = null) {
    const pending = Storage.get(APP_CONFIG.STORAGE_KEYS.VERIFICATION_PENDING);
    let email = emailOverride;
    if (!email && typeof window !== 'undefined') {
      try {
        email = new URLSearchParams(window.location.search).get('email');
      } catch {}
    }
    if (!email && pending?.email) {
      email = pending.email;
    }
    email = (email || '').trim().toLowerCase();

    if (APP_CONFIG.USE_MOCK_DATA) {
      await new Promise(r => setTimeout(r, 300));
      if (!pending && !email) {
        return { success: false, message: 'No pending registration found.' };
      }

      if (code === '123456' || code === pending?.verificationCode) {
        const verified = pending || { email, role: 'student', name: 'Demo Student', matricNo: 'CSC/2021/045' };
        verified.isVerified = true;
        delete verified.verificationCode;
        const accounts = Storage.get('care_oau_demo_accounts', []).filter(a => a.id !== verified.id);
        Storage.set('care_oau_demo_accounts', [...accounts, verified]);
        Storage.set(APP_CONFIG.STORAGE_KEYS.AUTH_USER, verified);
        Storage.remove(APP_CONFIG.STORAGE_KEYS.VERIFICATION_PENDING);
        return { success: true, user: verified };
      }

      return { success: false, message: 'Invalid verification code. (Hint: Use demo code 123456)' };
    }

    if (!email) {
      return {
        success: false,
        message: 'Email address missing for verification. Please return to registration.'
      };
    }

    try {
      const res = await Api.post('/auth/verify-email', {
        email,
        code: String(code).trim()
      });

      const rawUser = res.data?.user || res.data || pending || {};
      const user = normalizeUser(rawUser, { email, ...pending });
      user.isVerified = true;
      Storage.set(APP_CONFIG.STORAGE_KEYS.AUTH_USER, user);
      Storage.remove(APP_CONFIG.STORAGE_KEYS.VERIFICATION_PENDING);

      return {
        success: true,
        message: res.message || 'Email verified successfully!',
        user
      };
    } catch (error) {
      return {
        success: false,
        message: error.message || 'Verification failed. Please check your code.',
        code: error.code,
        details: error.details || []
      };
    }
  },

  /**
   * Request password reset via backend POST /api/v1/auth/forgot-password
   */
  async forgotPassword(email) {
    const cleanEmail = (email || '').trim().toLowerCase();
    if (!cleanEmail) {
      return { success: false, message: 'Please provide your registered student email address.' };
    }

    if (APP_CONFIG.USE_MOCK_DATA) {
      await new Promise(r => setTimeout(r, 400));
      return { success: true, message: 'Simulated reset instructions generated!' };
    }

    try {
      const res = await Api.post('/auth/forgot-password', { email: cleanEmail });
      return {
        success: true,
        message: res.message || "If your account exists, you'll receive a password reset email"
      };
    } catch (error) {
      return {
        success: false,
        message: error.message || 'Unable to process password reset request.',
        code: error.code
      };
    }
  },

  /**
   * Reset student password via backend POST /api/v1/auth/reset-password
   */
  async resetPassword({ email, code, password }) {
    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanCode = (code || '').trim();

    if (APP_CONFIG.USE_MOCK_DATA) {
      await new Promise(r => setTimeout(r, 400));
      return { success: true, message: 'Password updated successfully!' };
    }

    if (!cleanEmail) {
      return { success: false, message: 'Email address is required to reset password.' };
    }
    if (!cleanCode) {
      return { success: false, message: 'Reset code is required.' };
    }

    try {
      const res = await Api.post('/auth/reset-password', {
        email: cleanEmail,
        code: cleanCode,
        password
      });

      return {
        success: true,
        message: res.message || 'Password reset successfully! You can now sign in.'
      };
    } catch (error) {
      return {
        success: false,
        message: error.message || 'Password reset failed.',
        code: error.code,
        details: error.details || []
      };
    }
  },

  /**
   * Log in clinic staff / administrator
   * NOTE: The deployed backend does not currently have staff authentication endpoints.
   * Staff/admin workflow operates in demonstration mode.
   */
  async loginAdmin({ staffId, password }) {
    await new Promise(r => setTimeout(r, 400));

    const adminUser = {
      id: 'staff_adm_001',
      name: 'Dr. T. A. Babalola',
      staffId: staffId.trim().toUpperCase(),
      role: 'admin',
      department: 'Health Centre Administration'
    };

    Storage.set(APP_CONFIG.STORAGE_KEYS.AUTH_USER, adminUser);
    return { success: true, user: adminUser };
  },

  /**
   * Check if current user is logged in from persistent client storage (synchronous)
   */
  getCurrentUser() {
    return Storage.get(APP_CONFIG.STORAGE_KEYS.AUTH_USER, null);
  },

  /**
   * Restore and validate session with backend GET /api/v1/users/me (asynchronous)
   */
  async checkSession() {
    if (APP_CONFIG.USE_MOCK_DATA) {
      return Storage.get(APP_CONFIG.STORAGE_KEYS.AUTH_USER, null);
    }

    try {
      const res = await Api.get('/users/me');
      const rawUser = res.data?.user || res.data || res.user;
      if (rawUser) {
        const cached = Storage.get(APP_CONFIG.STORAGE_KEYS.AUTH_USER) || {};
        const user = normalizeUser(rawUser, cached);
        Storage.set(APP_CONFIG.STORAGE_KEYS.AUTH_USER, user);
        return user;
      }
      return null;
    } catch (error) {
      if (error.status === 401) {
        Storage.remove(APP_CONFIG.STORAGE_KEYS.AUTH_USER);
        return null;
      }
      return Storage.get(APP_CONFIG.STORAGE_KEYS.AUTH_USER, null);
    }
  },

  /**
   * Log out current session via backend POST /api/v1/auth/logout and clear client state
   */
  async logout() {
    if (!APP_CONFIG.USE_MOCK_DATA) {
      try {
        await Api.post('/auth/logout');
      } catch (err) {
        console.warn('[Care-OAU] Logout API notice:', err.message);
      }
    }
    Storage.remove(APP_CONFIG.STORAGE_KEYS.AUTH_USER);
    Storage.remove(APP_CONFIG.STORAGE_KEYS.AUTH_TOKEN);
    return { success: true };
  }
};
