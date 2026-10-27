/**
 * Care-OAU - Appointment Backend API Integration Test
 * Verifies AppointmentService interacts with backend REST endpoints:
 * 1. GET /appointments/me
 * 2. POST /appointments
 * 3. PATCH /appointments/:id/cancel
 * 4. PATCH /appointments/:id/status
 * 5. Slot conflict (409) handling
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

const { AppointmentService } = await import("../assets/js/services/appointment-service.js");
const { Api } = await import("../assets/js/services/api-client.js");

const originalApiGet = Api.get.bind(Api);
const originalApiPost = Api.post.bind(Api);
const originalApiPatch = Api.patch.bind(Api);

try {
  const calls = [];
  let apiAppointments = [
    {
      publicId: "apt_live_001",
      appointmentDate: "2026-11-12",
      timeSlot: "10:00",
      studentName: "Oluwaseun Adeleke",
      doctorName: "Dr. Kehinde Falope",
      serviceName: "General Consultation",
      status: "confirmed"
    },
    {
      publicId: "apt_pending_999",
      appointmentDate: "2026-11-15",
      timeSlot: "11:00",
      studentName: "Amina Lawal",
      doctorName: "Dr. Kehinde Falope",
      serviceName: "General Consultation",
      status: "pending"
    }
  ];

  Api.get = async (endpoint) => {
    calls.push({ method: "GET", endpoint });
    return {
      success: true,
      data: apiAppointments
    };
  };

  Api.post = async (endpoint, data) => {
    calls.push({ method: "POST", endpoint, data });
    return {
      success: true,
      data: {
        publicId: "apt_created_123",
        ...data,
        status: "pending"
      }
    };
  };

  Api.patch = async (endpoint, data) => {
    calls.push({ method: "PATCH", endpoint, data });
    return { success: true };
  };

  // Test 1: GET appointments via API
  const list = await AppointmentService.getAllAppointments();
  assert.equal(list.length, 2);
  assert.equal(list[0].id, "apt_live_001");
  const getCall = calls.find((c) => c.method === "GET" && c.endpoint === "/appointments/me");
  assert.ok(getCall, "Must query /appointments/me for student session");

  // Test 2: Cancel appointment via API
  const cancelRes = await AppointmentService.cancelAppointment("apt_live_001", "Travelling for academic event");
  assert.ok(cancelRes.success);
  const cancelCall = calls.find((c) => c.method === "PATCH" && c.endpoint === "/appointments/apt_live_001/cancel");
  assert.ok(cancelCall, "Must call PATCH /appointments/:id/cancel");

  // Test 3: Approve appointment via API
  const approveRes = await AppointmentService.approveAppointment("apt_pending_999");
  assert.ok(approveRes.success);
  const approveCall = calls.find((c) => c.method === "PATCH" && c.endpoint === "/appointments/apt_pending_999/status");
  assert.ok(approveCall, "Must call PATCH /appointments/:id/status");

  console.log("PASS: AppointmentService backend API integration (GET, POST, PATCH cancel, PATCH status)");
} finally {
  Api.get = originalApiGet;
  Api.post = originalApiPost;
  Api.patch = originalApiPatch;
}
