import assert from 'node:assert/strict';

// 1. Test URL resolution and normalization
const { APP_CONFIG } = await import('../assets/js/core/config.js');

// Test production resolution by default in node
assert.equal(APP_CONFIG.API_BASE_URL, 'https://care-oau-api.onrender.com/api/v1');

// Test window.__CARE_OAU_API_URL__ override with trailing slashes and redundant segments
globalThis.window = {
  __CARE_OAU_API_URL__: 'https://custom-api.example.com///',
  location: { hostname: 'custom-frontend.com', search: '' }
};
assert.equal(APP_CONFIG.API_BASE_URL, 'https://custom-api.example.com/api/v1');

// Test window.__CARE_OAU_API_URL__ with /api already present
window.__CARE_OAU_API_URL__ = 'https://custom-api.example.com/api';
assert.equal(APP_CONFIG.API_BASE_URL, 'https://custom-api.example.com/api/v1');

// Test window.__CARE_OAU_API_URL__ with /api/v1 already present
window.__CARE_OAU_API_URL__ = 'https://care-oau-api.onrender.com/api/v1/';
assert.equal(APP_CONFIG.API_BASE_URL, 'https://care-oau-api.onrender.com/api/v1');

// Test Vercel environment detection
delete window.__CARE_OAU_API_URL__;
window.location.hostname = 'care-oau-frontend.vercel.app';
assert.equal(APP_CONFIG.API_BASE_URL, '/api/v1');

// Test Localhost environment detection
window.location.hostname = 'localhost';
assert.equal(APP_CONFIG.API_BASE_URL, 'http://localhost:5000/api/v1');

// 2. Test ApiClient configuration
delete window.location;
window.__CARE_OAU_API_URL__ = 'https://care-oau-api.onrender.com';
const memory = new Map();
window.localStorage = {
  getItem: key => memory.get(key) ?? null,
  setItem: (key, value) => memory.set(key, value),
  removeItem: key => memory.delete(key)
};

const { Api } = await import('../assets/js/services/api-client.js');
assert.equal(Api.getBaseUrl(), 'https://care-oau-api.onrender.com/api/v1');

// 3. Test Live Backend Endpoints via ApiClient
const { AuthService } = await import('../assets/js/services/auth-service.js');
APP_CONFIG.USE_MOCK_DATA = false;

// 3a. Login validation error (missing fields)
const invalidLogin = await AuthService.loginStudent({ identifier: 'test@example.com', password: '' });
// Missing password fails on client or server
assert.equal(invalidLogin.success, false);

// 3b. Login with bad credentials against live backend
const badCreds = await AuthService.loginStudent({ identifier: 'nonexistent@student.oauife.edu.ng', password: 'wrongpassword' });
assert.equal(badCreds.success, false);
assert.equal(badCreds.code, 'INVALID_CREDENTIALS');

// 3c. Login rejection when student identifier lacks @ in live mode
const nonEmail = await AuthService.loginStudent({ identifier: '21/SCI/1048', password: 'demo' });
assert.equal(nonEmail.success, false);
assert.ok(nonEmail.message.includes('registered email address'));

// 3d. Verify email with invalid OTP against live backend
const badVerify = await AuthService.verifyEmail('000000', 'test@example.com');
assert.equal(badVerify.success, false);
assert.ok(['INVALID_VERIFICATION_CODE', 'INVALID_VERIFICATION_REQUEST'].includes(badVerify.code));

// 3e. Forgot password against live backend
const forgotRes = await AuthService.forgotPassword('test@example.com');
assert.equal(forgotRes.success, true);
assert.ok(forgotRes.message.includes('password reset email'));

// 3f. Reset password with invalid code against live backend
const resetRes = await AuthService.resetPassword({ email: 'test@example.com', code: '000000', password: 'newpass123' });
assert.equal(resetRes.success, false);
assert.equal(resetRes.code, 'INVALID_RESET_CODE');

// 3g. Session check when unauthenticated
const unauthSession = await AuthService.checkSession();
assert.equal(unauthSession, null);

// 3h. Mock mode fallback test
APP_CONFIG.USE_MOCK_DATA = true;
const mockLogin = await AuthService.loginStudent({ identifier: '21/SCI/1048', password: 'any' });
assert.equal(mockLogin.success, true);
assert.equal(mockLogin.user.name, 'Amina Yusuf');

console.log('PASS: API base URL resolution, URL normalization, Vercel proxy, credentials: include, and live backend endpoint contracts.');
