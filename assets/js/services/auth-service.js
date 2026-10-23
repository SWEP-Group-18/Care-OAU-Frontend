/**
 * Care-OAU - Authentication Service
 * Manages user authentication, session state, and simulated registration/verification flows.
 * DEMO NOTICE: In this prototype scaffold, authentication is simulated.
 * Do not enter real sensitive passwords or health credentials.
 */

import { Storage } from '../core/storage.js';
import { APP_CONFIG } from '../core/config.js';

export const AuthService = {
  /**
   * Log in a student using Matric Number / Email and Password
   */
  async loginStudent({ identifier, password, remember = false }) {
    // Simulated network latency
    await new Promise(r => setTimeout(r, 400));

    // Demo account fallback if none exists
    const demoUser = {
      id: identifier.trim().toUpperCase() === '21/SCI/1048' ? 'usr_student_amina' : 'usr_student_01',
      name: identifier.trim().toUpperCase() === '21/SCI/1048' ? 'Amina Yusuf' : 'Oluwaseun Adeleke',
      matricNo: identifier.toUpperCase().includes('/') ? identifier.toUpperCase() : 'CSC/2021/045',
      email: identifier.includes('@') ? identifier.toLowerCase() : 'oadeleke@student.oauife.edu.ng',
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
    Storage.set(APP_CONFIG.STORAGE_KEYS.AUTH_TOKEN, 'demo_jwt_token_care_oau_student');

    return { success: true, user: demoUser };
  },

  /**
   * Register a new student account
   */
  async registerStudent({ fullName, matricNo, email, phone, password }) {
    await new Promise(r => setTimeout(r, 500));

    const pendingUser = {
      id: `usr_${Date.now()}`,
      name: fullName.trim(),
      matricNo: matricNo.trim().toUpperCase(),
      email: email.trim().toLowerCase(),
      phone: phone.trim(),
      role: 'student',
      isVerified: false,
      verificationCode: '123456' // Standard demonstration code
    };

    // Save pending verification state
    Storage.set(APP_CONFIG.STORAGE_KEYS.VERIFICATION_PENDING, pendingUser);

    return { 
      success: true, 
      message: 'Account created! Please verify your student email.', 
      user: pendingUser 
    };
  },

  /**
   * Verify student email via 6-digit OTP
   */
  async verifyEmail(code) {
    await new Promise(r => setTimeout(r, 400));

    const pending = Storage.get(APP_CONFIG.STORAGE_KEYS.VERIFICATION_PENDING);
    if (!pending) {
      return { success: false, message: 'No pending registration found.' };
    }

    if (code === '123456' || code === pending.verificationCode) {
      pending.isVerified = true;
      delete pending.verificationCode;
      const accounts = Storage.get('care_oau_demo_accounts', []).filter(a => a.id !== pending.id);
      Storage.set('care_oau_demo_accounts', [...accounts, pending]);
      
      Storage.set(APP_CONFIG.STORAGE_KEYS.AUTH_USER, pending);
      Storage.set(APP_CONFIG.STORAGE_KEYS.AUTH_TOKEN, 'demo_jwt_token_care_oau_verified');
      Storage.remove(APP_CONFIG.STORAGE_KEYS.VERIFICATION_PENDING);

      return { success: true, user: pending };
    }

    return { success: false, message: 'Invalid verification code. (Hint: Use demo code 123456)' };
  },

  /**
   * Log in clinic staff / administrator
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
    Storage.set(APP_CONFIG.STORAGE_KEYS.AUTH_TOKEN, 'demo_jwt_token_care_oau_staff');

    return { success: true, user: adminUser };
  },

  /**
   * Check if current user is logged in
   */
  getCurrentUser() {
    return Storage.get(APP_CONFIG.STORAGE_KEYS.AUTH_USER, null);
  },

  /**
   * Log out current session
   */
  logout() {
    Storage.remove(APP_CONFIG.STORAGE_KEYS.AUTH_USER);
    Storage.remove(APP_CONFIG.STORAGE_KEYS.AUTH_TOKEN);
  }
};
