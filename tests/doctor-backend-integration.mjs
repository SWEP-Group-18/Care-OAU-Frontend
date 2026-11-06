/**
 * Care-OAU - Frontend Doctor Service Backend API Integration Test
 * Verifies that DoctorService communicates with the documented OpenAPI REST endpoints:
 * 1. POST /admin/doctors (Doctor creation)
 * 2. PATCH /admin/doctors/:publicId (Doctor updating)
 * 3. PATCH /admin/doctors/:publicId/status (Status / attendance updates)
 * 4. DELETE /admin/doctors/:publicId (Doctor deletion)
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

const originalApiPost = Api.post.bind(Api);
const originalApiPatch = Api.patch.bind(Api);

try {
  const calls = [];
  Api.post = async (endpoint, data) => {
    calls.push({ method: "POST", endpoint, data });
    if (endpoint === "/admin/doctors") {
      return { success: true, data: { doctor: { publicId: "doc_test_backend_001", ...data } } };
    }
    return { success: true };
  };

  Api.patch = async (endpoint, data) => {
    calls.push({ method: "PATCH", endpoint, data });
    return { success: true, data: { doctor: { publicId: "doc_test_backend_001", ...data } } };
  };

  // Test 1: Save new doctor strictly calls POST /admin/doctors
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
  const postCall = calls.find((c) => c.method === "POST" && c.endpoint === "/admin/doctors");
  assert.ok(postCall, "Must strictly call POST /admin/doctors to create doctor");
  assert.equal(postCall.data.name, "Dr. Kehinde Falope");
  assert.deepEqual(postCall.data.workingDays, ["Mon", "Wed", "Fri"]);
  assert.equal(postCall.data.startTime, "08:00:00");
  assert.equal(postCall.data.endTime, "15:00:00");
  assert.equal(postCall.data.dailyPatientLimit, 20);

  // Test 2: Deactivate doctor calls PATCH /admin/doctors/:id/status
  await DoctorService.deactivateDoctor("doc_test_backend_001");
  const deactCall = calls.find((c) => c.method === "PATCH" && c.endpoint === "/admin/doctors/doc_test_backend_001/status");
  assert.ok(deactCall, "Must call PATCH /admin/doctors/:id/status for deactivation");
  assert.equal(deactCall.data.status, "off_duty");

  // Test 3: Toggle availability calls PATCH /admin/doctors/:id/status
  await DoctorService.toggleAvailability("doc_test_backend_001", false);
  const availCall = calls.filter((c) => c.method === "PATCH" && c.endpoint === "/admin/doctors/doc_test_backend_001/status").pop();
  assert.ok(availCall, "Must call PATCH /admin/doctors/:id/status for availability toggle");
  assert.equal(availCall.data.status, "on_break");

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

  console.log("PASS: DoctorService backend API mutations (/admin/doctors POST, PATCH, status, DELETE)");
} finally {
  Api.post = originalApiPost;
  Api.patch = originalApiPatch;
}
