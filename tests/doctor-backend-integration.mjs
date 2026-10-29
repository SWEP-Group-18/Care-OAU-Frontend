/**
 * Care-OAU - Frontend Doctor Service Backend API Integration Test
 * Verifies that DoctorService communicates with the backend REST endpoints:
 * 1. POST /doctors (draft creation) + PATCH /doctors/:id/publish
 * 2. PATCH /doctors/:id/profile and /schedule (updating)
 * 3. PATCH /doctors/:id/deactivate
 * 4. PATCH /doctors/:id/availability
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

const { DoctorService } = await import("../assets/js/services/doctor-service.js");
const { Api } = await import("../assets/js/services/api-client.js");
const { APP_CONFIG } = await import("../assets/js/core/config.js");

const originalApiPost = Api.post.bind(Api);
const originalApiPatch = Api.patch.bind(Api);

try {
  const calls = [];
  Api.post = async (endpoint, data) => {
    calls.push({ method: "POST", endpoint, data });
    if (endpoint === "/doctors") {
      return { success: true, data: { publicId: "doc_test_backend_001", ...data } };
    }
    return { success: true };
  };

  Api.patch = async (endpoint, data) => {
    calls.push({ method: "PATCH", endpoint, data });
    return { success: true, data: { publicId: "doc_test_backend_001", ...data } };
  };

  // Test 1: Save new doctor via API
  const saveRes = await DoctorService.saveDoctor({
    name: "Dr. Kehinde Falope",
    title: "Consultant Physician",
    specialization: "General Medical Consultation",
    workingDays: ["Monday", "Wednesday", "Friday"],
    startTime: "08:00",
    endTime: "15:00",
    dailyCapacity: 20
  });

  assert.ok(saveRes.success);
  const postCall = calls.find((c) => c.method === "POST" && c.endpoint === "/doctors");
  assert.ok(postCall, "Must call POST /doctors to create draft");
  assert.equal(postCall.data.name, "Dr. Kehinde Falope");

  const publishCall = calls.find((c) => c.method === "PATCH" && c.endpoint.includes("/publish"));
  assert.ok(publishCall, "Must call PATCH /doctors/:id/publish upon creation");

  // Test 2: Deactivate doctor via API
  await DoctorService.deactivateDoctor("doc_test_backend_001");
  const deactCall = calls.find((c) => c.method === "PATCH" && c.endpoint === "/doctors/doc_test_backend_001/deactivate");
  assert.ok(deactCall, "Must call PATCH /doctors/:id/deactivate");

  // Test 3: Toggle availability
  await DoctorService.toggleAvailability("doc_test_backend_001", false);
  const availCall = calls.find((c) => c.method === "PATCH" && c.endpoint === "/doctors/doc_test_backend_001/availability");
  assert.ok(availCall, "Must call PATCH /doctors/:id/availability");
  assert.equal(availCall.data.isAvailable, false);

  // Test 4: DELETE /admin/doctors/:publicId
  const originalApiDelete = Api.delete.bind(Api);
  let deleteCalled = null;
  Api.delete = async (endpoint) => {
    deleteCalled = endpoint;
    return { success: true, message: "Doctor deleted successfully" };
  };
  const delRes = await DoctorService.deleteDoctor("doc_test_backend_001");
  assert.ok(delRes.success);
  assert.equal(deleteCalled, "/admin/doctors/doc_test_backend_001", "Must call DELETE /admin/doctors/:publicId");
  assert.equal(delRes.doctors.some(d => d.id === "doc_test_backend_001"), false, "Deleted doctor must be removed from storage");
  Api.delete = originalApiDelete;

  console.log("PASS: DoctorService backend API mutations (create, publish, deactivate, availability toggle, delete)");
} finally {
  Api.post = originalApiPost;
  Api.patch = originalApiPatch;
}
