/**
 * Care-OAU - Queue Service Backend API Integration Test
 * Verifies QueueService communicates with /queue REST endpoints:
 * 1. POST /queue/check-in
 * 2. GET /queue/me
 * 3. PATCH /queue/:id/call
 * 4. PATCH /queue/:id/no-show
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

const { QueueService } = await import("../assets/js/services/queue-service.js");
const { Api } = await import("../assets/js/services/api-client.js");

const originalApiGet = Api.get.bind(Api);
const originalApiPost = Api.post.bind(Api);
const originalApiPatch = Api.patch.bind(Api);

try {
  const calls = [];
  Api.get = async (endpoint) => {
    calls.push({ method: "GET", endpoint });
    if (endpoint === "/queue/me") {
      return {
        success: true,
        data: {
          ticket: {
            publicId: "qtk_001",
            ticketNumber: "Q-001",
            status: "waiting",
            doctorName: "Dr. Kehinde Falope",
            serviceName: "General Consultation",
            checkInTime: new Date().toISOString()
          },
          position: 2,
          estimatedWaitMinutes: 15
        }
      };
    }
    return { success: true, data: [] };
  };

  Api.post = async (endpoint, data) => {
    calls.push({ method: "POST", endpoint, data });
    return {
      success: true,
      data: {
        publicId: "qtk_new_005",
        ticketNumber: "Q-005",
        appointmentPublicId: data.appointmentPublicId,
        studentName: "Amina Lawal",
        status: "waiting"
      }
    };
  };

  Api.patch = async (endpoint, data) => {
    calls.push({ method: "PATCH", endpoint, data });
    return { success: true };
  };

  // Test 1: Check in appointment
  const checkInRes = await QueueService.checkIn("apt_to_checkin");
  assert.ok(checkInRes.success);
  const postCall = calls.find((c) => c.method === "POST" && c.endpoint === "/queue/check-in");
  assert.ok(postCall, "Must call POST /queue/check-in");
  assert.equal(postCall.data.appointmentPublicId, "apt_to_checkin");

  // Test 2: Get student active ticket
  const activeTicket = await QueueService.getStudentActiveTicket();
  assert.ok(activeTicket);
  assert.equal(activeTicket.ticketNumber, "Q-001");
  assert.equal(activeTicket.position, 2);
  assert.equal(activeTicket.estimatedWaitMinutes, 15);
  const getMeCall = calls.find((c) => c.method === "GET" && c.endpoint === "/queue/me");
  assert.ok(getMeCall, "Must call GET /queue/me");

  // Test 3: Call patient
  await QueueService.callPatient("qtk_001");
  const callCall = calls.find((c) => c.method === "PATCH" && c.endpoint === "/queue/qtk_001/call");
  assert.ok(callCall, "Must call PATCH /queue/:id/call");

  // Test 4: Mark no-show
  await QueueService.markNoShow("qtk_001");
  const noShowCall = calls.find((c) => c.method === "PATCH" && c.endpoint === "/queue/qtk_001/no-show");
  assert.ok(noShowCall, "Must call PATCH /queue/:id/no-show");

  console.log("PASS: QueueService backend API integration (check-in, student ticket & wait time, calling, absent)");
} finally {
  Api.get = originalApiGet;
  Api.post = originalApiPost;
  Api.patch = originalApiPatch;
}
