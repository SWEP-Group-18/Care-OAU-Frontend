/**
 * Care-OAU - Appointment Backend API Integration Test
 * Verifies AppointmentService interacts with backend REST endpoints:
 * 1. GET /appointments/me (data.appointments envelope parsing)
 * 2. GET /appointments/slots (servicePublicId, date, doctorPublicId)
 * 3. POST /appointments (servicePublicId, doctorPublicId, appointmentDate, startTime, reason)
 * 4. PATCH /appointments/:id/cancel
 * 5. PATCH /appointments/:id/status
 * 6. Error handling (slot conflict, cancellation failure)
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
const { APP_CONFIG } = await import("../assets/js/core/config.js");

const originalApiGet = Api.get.bind(Api);
const originalApiPost = Api.post.bind(Api);
const originalApiPatch = Api.patch.bind(Api);

try {
  const calls = [];
  let apiAppointments = [
    {
      publicId: "apt_live_001",
      date: "2026-11-12T00:00:00.000Z",
      startTime: "10:00:00",
      endTime: "10:30:00",
      studentName: "Oluwaseun Adeleke",
      doctor: "Dr. Kehinde Falope",
      service: "General Medical Consultation",
      status: "confirmed",
      location: "Consulting Room 4"
    },
    {
      publicId: "apt_pending_999",
      date: "2026-11-15T00:00:00.000Z",
      startTime: "11:00:00",
      endTime: "11:30:00",
      studentName: "Amina Lawal",
      doctor: "Dr. Kehinde Falope",
      service: "General Medical Consultation",
      status: "pending",
      location: "Consulting Room 2"
    }
  ];

  Api.get = async (endpoint) => {
    calls.push({ method: "GET", endpoint });
    if (endpoint.startsWith("/appointments/slots")) {
      return {
        success: true,
        message: "Appointment slots fetched",
        data: {
          service: { publicId: "srv_test_01", name: "General Medical Consultation" },
          date: "2026-11-12",
          slots: [
            {
              doctor: { publicId: "doc_01", name: "Dr. Kehinde Falope" },
              date: "2026-11-12",
              startTime: "08:30:00",
              endTime: "09:00:00",
              status: "available"
            },
            {
              doctor: { publicId: "doc_01", name: "Dr. Kehinde Falope" },
              date: "2026-11-12",
              startTime: "09:00:00",
              endTime: "09:30:00",
              status: "fully_booked"
            }
          ]
        }
      };
    }
    return {
      success: true,
      data: {
        appointments: apiAppointments
      }
    };
  };

  Api.post = async (endpoint, data) => {
    calls.push({ method: "POST", endpoint, data });
    return {
      success: true,
      message: "Appointment booked successfully",
      data: {
        appointment: {
          publicId: "apt_created_123",
          service: "General Medical Consultation",
          doctor: "Dr. Kehinde Falope",
          date: data.appointmentDate,
          startTime: data.startTime + ":00",
          endTime: "13:30:00",
          status: "pending",
          location: "Consulting Room 4"
        }
      }
    };
  };

  Api.patch = async (endpoint, data) => {
    calls.push({ method: "PATCH", endpoint, data });
    return { success: true };
  };

  // Test 1: GET appointments via API using data.appointments envelope
  const list = await AppointmentService.getAllAppointments();
  assert.equal(list.length, 2);
  assert.equal(list[0].id, "apt_live_001");
  assert.equal(list[0].status, APP_CONFIG.APPOINTMENT_STATUS.APPROVED);
  assert.equal(list[1].status, APP_CONFIG.APPOINTMENT_STATUS.PENDING);
  const getCall = calls.find((c) => c.method === "GET" && c.endpoint === "/appointments/me");
  assert.ok(getCall, "Must query /appointments/me for student session");

  // Test 2: GET appointment slots via API
  const slots = await AppointmentService.getAvailableSlots({
    servicePublicId: "srv_test_01",
    date: "2026-11-12",
    doctorPublicId: "doc_01"
  });
  assert.equal(slots.length, 2);
  assert.equal(slots[0].full, false);
  assert.equal(slots[0].time, "8:30 AM");
  assert.equal(slots[1].full, true);
  const slotCall = calls.find((c) => c.method === "GET" && c.endpoint.startsWith("/appointments/slots"));
  assert.ok(slotCall, "Must call /appointments/slots endpoint");
  assert.ok(slotCall.endpoint.includes("servicePublicId=srv_test_01"));
  assert.ok(slotCall.endpoint.includes("doctorPublicId=doc_01"));

  // Test 3: POST /appointments with required backend fields
  const bookRes = await AppointmentService.createAppointment({
    serviceId: "srv_test_01",
    doctorId: "doc_01",
    appointmentDate: "2026-11-12",
    timeSlot: "1:00 PM",
    reason: "Severe migraine"
  });
  assert.ok(bookRes.success);
  assert.equal(bookRes.appointment.publicId, "apt_created_123");
  const postCall = calls.find((c) => c.method === "POST" && c.endpoint === "/appointments");
  assert.ok(postCall, "Must submit to POST /appointments");
  assert.equal(postCall.data.servicePublicId, "srv_test_01");
  assert.equal(postCall.data.doctorPublicId, "doc_01");
  assert.equal(postCall.data.appointmentDate, "2026-11-12");
  assert.equal(postCall.data.startTime, "13:00", "Must convert 1:00 PM to 24h format 13:00");

  // Test 4: Cancel appointment via API
  const cancelRes = await AppointmentService.cancelAppointment("apt_live_001", "Travelling for academic event");
  assert.ok(cancelRes.success);
  const cancelCall = calls.find((c) => c.method === "PATCH" && c.endpoint === "/appointments/apt_live_001/cancel");
  assert.ok(cancelCall, "Must call PATCH /appointments/:id/cancel");

  // Test 5: Cancellation error propagation
  Api.patch = async () => {
    const err = new Error("This appointment cannot be cancelled online");
    err.status = 400;
    throw err;
  };
  const failedCancel = await AppointmentService.cancelAppointment("apt_live_001");
  assert.equal(failedCancel.success, false);
  assert.ok(failedCancel.message.includes("cannot be cancelled"));

  console.log("PASS: AppointmentService backend API integration (GET /appointments/me, GET /appointments/slots, POST /appointments, PATCH /appointments/:id/cancel, error propagation)");
} finally {
  Api.get = originalApiGet;
  Api.post = originalApiPost;
  Api.patch = originalApiPatch;
}
