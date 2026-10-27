/**
 * Care-OAU - Medical Services API Integration Test
 * Verifies MedicalService communicates with /services endpoints:
 * 1. GET /services
 * 2. POST /services
 * 3. PATCH /services/:id
 * 4. PATCH /services/:id/status
 */

import assert from "node:assert/strict";

const storageMap = new Map();
globalThis.window = {
  localStorage: {
    getItem: (key) => storageMap.get(key) ?? null,
    setItem: (key, value) => storageMap.set(key, String(value)),
    removeItem: (key) => storageMap.delete(key),
    clear: () => storageMap.clear()
  },
  location: { hostname: "localhost", search: "" }
};

const { MedicalService } = await import("../assets/js/services/medical-service.js");
const { Api } = await import("../assets/js/services/api-client.js");

const originalApiGet = Api.get.bind(Api);
const originalApiPost = Api.post.bind(Api);
const originalApiPatch = Api.patch.bind(Api);

try {
  const calls = [];
  Api.get = async (endpoint) => {
    calls.push({ method: "GET", endpoint });
    return { success: true, data: [{ publicId: "srv_001", name: "Dental Clinic", isActive: true }] };
  };

  Api.post = async (endpoint, data) => {
    calls.push({ method: "POST", endpoint, data });
    return { success: true, data: { publicId: "srv_new_002", ...data } };
  };

  Api.patch = async (endpoint, data) => {
    calls.push({ method: "PATCH", endpoint, data });
    return { success: true, data: { publicId: "srv_001", ...data } };
  };

  // Test 1: GET /services
  const services = await MedicalService.getAllServices();
  assert.equal(services.length, 1);
  assert.equal(services[0].name, "Dental Clinic");
  const getCall = calls.find((c) => c.method === "GET" && c.endpoint === "/services");
  assert.ok(getCall, "Must call GET /services");

  // Test 2: POST /services
  await MedicalService.saveService({ name: "Eye Clinic", capacityPerDay: 30 });
  const postCall = calls.find((c) => c.method === "POST" && c.endpoint === "/services");
  assert.ok(postCall, "Must call POST /services");
  assert.equal(postCall.data.name, "Eye Clinic");

  // Test 3: PATCH /services/:id
  await MedicalService.saveService({ publicId: "srv_001", name: "Advanced Dental Clinic" });
  const patchCall = calls.find((c) => c.method === "PATCH" && c.endpoint === "/services/srv_001");
  assert.ok(patchCall, "Must call PATCH /services/:id");

  // Test 4: PATCH /services/:id/status
  await MedicalService.toggleStatus("srv_001");
  const statusCall = calls.find((c) => c.method === "PATCH" && c.endpoint === "/services/srv_001/status");
  assert.ok(statusCall, "Must call PATCH /services/:id/status");

  console.log("PASS: MedicalService backend API integration (GET, POST, PATCH, status toggle)");
} finally {
  Api.get = originalApiGet;
  Api.post = originalApiPost;
  Api.patch = originalApiPatch;
}
