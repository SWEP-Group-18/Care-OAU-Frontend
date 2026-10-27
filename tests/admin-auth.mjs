/**
 * Care-OAU - Admin Role-Based Authentication & Route Guard Test Suite
 * Verifies that:
 * 1. Admin login endpoint integration and credential validation
 * 2. Student accounts attempting admin login are denied access with FORBIDDEN_ROLE
 * 3. Legitimate admin accounts obtain access and correct role normalization
 * 4. Route guards prevent unauthenticated users from accessing protected admin pages
 * 5. Route guards deny student sessions from accessing admin pages
 * 6. Expired or invalid sessions redirect safely without redirect loops
 * 7. Logout clears client state and issues backend logout call
 */

import assert from 'node:assert/strict';

// Set up mock browser environment
const storageMap = new Map();
globalThis.window = {
  location: { pathname: '/admin/dashboard.html', search: '', href: '' },
  localStorage: {
    getItem: key => storageMap.get(key) ?? null,
    setItem: (key, value) => storageMap.set(key, String(value)),
    removeItem: key => storageMap.delete(key),
    clear: () => storageMap.clear()
  }
};

const { Storage } = await import('../assets/js/core/storage.js');
const { APP_CONFIG } = await import('../assets/js/core/config.js');
const { AuthService } = await import('../assets/js/services/auth-service.js');
const { Navigation } = await import('../assets/js/core/navigation.js');
const { Api } = await import('../assets/js/services/api-client.js');

// Save original Api methods
const originalApiPost = Api.post.bind(Api);
const originalApiGet = Api.get.bind(Api);

try {
  // Test 1: Admin login validation (missing email/password in live mode)
  APP_CONFIG.USE_MOCK_DATA = false;
  Storage.clear();

  const emptyRes = await AuthService.loginAdmin({ email: '', password: '' });
  assert.equal(emptyRes.success, false);
  assert.ok(emptyRes.message.includes('registered hospital staff email address'));

  const nonEmailRes = await AuthService.loginAdmin({ email: 'NOT_AN_EMAIL', password: 'secretpassword' });
  assert.equal(nonEmailRes.success, false);
  assert.ok(nonEmailRes.message.includes('registered hospital staff email address'));

  const missingPassRes = await AuthService.loginAdmin({ email: 'staff@oauife.edu.ng', password: '' });
  assert.equal(missingPassRes.success, false);
  assert.ok(missingPassRes.message.includes('Password is required'));

  // Test 2: Admin login with student credentials (role !== 'admin')
  // Mock API returning a student account
  let logoutCalled = false;
  Api.post = async (endpoint, body) => {
    if (endpoint === '/auth/login') {
      return {
        success: true,
        message: 'Logged in successfully',
        data: {
          user: {
            publicId: 'usr_student_01',
            name: 'Oluwaseun Adeleke',
            email: 'oadeleke@student.oauife.edu.ng',
            matricNumber: 'CSC/2021/045',
            role: 'student'
          }
        }
      };
    }
    if (endpoint === '/auth/logout') {
      logoutCalled = true;
      return { success: true };
    }
    return originalApiPost(endpoint, body);
  };

  const studentLoginAsAdmin = await AuthService.loginAdmin({
    email: 'oadeleke@student.oauife.edu.ng',
    password: 'StudentPassword123'
  });

  assert.equal(studentLoginAsAdmin.success, false, 'Student account must be denied admin access');
  assert.equal(studentLoginAsAdmin.code, 'FORBIDDEN_ROLE');
  assert.ok(studentLoginAsAdmin.message.includes('Student accounts cannot access the staff portal'));
  assert.equal(logoutCalled, true, 'Student session must be immediately revoked on backend');
  assert.equal(Storage.get(APP_CONFIG.STORAGE_KEYS.AUTH_USER), null, 'Student credentials must not remain in storage');

  // Test 3: Admin login with legitimate admin account (role === 'admin')
  Api.post = async (endpoint, body) => {
    if (endpoint === '/auth/login') {
      return {
        success: true,
        message: 'Logged in successfully',
        data: {
          user: {
            publicId: 'usr_admin_001',
            name: 'Dr. Kehinde Falope',
            email: 'admin@oauife.edu.ng',
            role: 'admin'
          }
        }
      };
    }
    return originalApiPost(endpoint, body);
  };

  const adminLoginRes = await AuthService.loginAdmin({
    email: 'admin@oauife.edu.ng',
    password: 'AdminPassword456'
  });

  assert.equal(adminLoginRes.success, true, 'Admin login must succeed');
  assert.equal(adminLoginRes.user.role, 'admin');
  assert.equal(adminLoginRes.user.name, 'Dr. Kehinde Falope');
  assert.equal(Storage.get(APP_CONFIG.STORAGE_KEYS.AUTH_USER)?.role, 'admin');

  // Test 4: Route guard - requireAuth('admin') when authenticated as admin
  window.location.pathname = '/admin/dashboard.html';
  window.location.href = '';
  const permittedUser = Navigation.requireAuth('admin');
  assert.ok(permittedUser, 'Admin user must be permitted to view dashboard');
  assert.equal(permittedUser.role, 'admin');
  assert.equal(window.location.href, '', 'No redirect should occur for authorized admin');

  // Test 5: Route guard - requireAuth('admin') when authenticated as student
  Storage.set(APP_CONFIG.STORAGE_KEYS.AUTH_USER, {
    id: 'usr_student_01',
    name: 'Student',
    role: 'student'
  });
  window.location.href = '';
  const deniedStudent = Navigation.requireAuth('admin');
  assert.equal(deniedStudent, null, 'Student must be denied access to admin routes');
  assert.ok(window.location.href.includes('login.html?denied=1'), 'Student must be redirected with denied notice');

  // Test 6: Route guard - requireAuth('admin') when unauthenticated
  Storage.clear();
  window.location.href = '';
  const unauthAdmin = Navigation.requireAuth('admin');
  assert.equal(unauthAdmin, null, 'Unauthenticated visitor must be denied access');
  assert.ok(window.location.href.includes('login.html'), 'Unauthenticated visitor must be redirected to login');

  // Test 7: Session sync - syncSession on expired session (401)
  Storage.set(APP_CONFIG.STORAGE_KEYS.AUTH_USER, {
    id: 'usr_admin_001',
    name: 'Admin',
    role: 'admin'
  });
  Api.get = async (endpoint) => {
    if (endpoint === '/users/me') {
      const err = new Error('HTTP Error 401: Unauthorized');
      err.status = 401;
      throw err;
    }
    return originalApiGet(endpoint);
  };

  window.location.pathname = '/admin/dashboard.html';
  window.location.href = '';
  await Navigation.syncSession('admin');
  assert.equal(Storage.get(APP_CONFIG.STORAGE_KEYS.AUTH_USER), null, 'Expired session must clear storage');
  assert.ok(window.location.href.includes('login.html?expired=1'), 'Expired session must redirect to login with expired notice');

  // Test 8: Logout
  Storage.set(APP_CONFIG.STORAGE_KEYS.AUTH_USER, {
    id: 'usr_admin_001',
    role: 'admin'
  });
  let backendLogoutTriggered = false;
  Api.post = async (endpoint) => {
    if (endpoint === '/auth/logout') {
      backendLogoutTriggered = true;
      return { success: true };
    }
    return originalApiPost(endpoint);
  };

  window.location.pathname = '/admin/dashboard.html';
  window.location.href = '';
  await Navigation.logout();
  assert.equal(backendLogoutTriggered, true, 'Logout endpoint must be called');
  assert.equal(Storage.get(APP_CONFIG.STORAGE_KEYS.AUTH_USER), null);
  assert.ok(window.location.href.includes('login.html?logout=1'), 'Admin logout must redirect to admin login');

  // Test 9: Student routes continue working and isolation remains intact
  window.location.pathname = '/student/dashboard.html';
  window.location.href = '';
  Storage.set(APP_CONFIG.STORAGE_KEYS.AUTH_USER, {
    id: 'usr_student_01',
    role: 'student',
    name: 'Student User'
  });
  const studentAccess = Navigation.requireAuth('student');
  assert.ok(studentAccess, 'Student must access student dashboard');
  assert.equal(studentAccess.role, 'student');
  assert.equal(window.location.href, '');

  console.log('PASS: admin credentials validation, student role rejection, legitimate admin access, route guards, expired session handling, logout, and student isolation.');
} finally {
  Api.post = originalApiPost;
  Api.get = originalApiGet;
}
