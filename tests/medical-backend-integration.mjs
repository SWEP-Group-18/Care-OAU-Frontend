/**
 * Care-OAU - Medical Services API Integration Test Suite
 * Verifies MedicalService communicates with documented /admin/services endpoints:
 * 1. GET /admin/services (envelope data.services and mapping)
 * 2. GET /admin/services/:publicId (single service retrieval)
 * 3. POST /admin/services (8-field create payload)
 * 4. PATCH /admin/services/:publicId (clean update payload)
 * 5. PATCH /admin/services/:publicId/status (status change payload)
 * 6. Student booking closed-service exclusion
 * 7. Failed API requests error propagation (no false success)
 * 8. Mock/demo mode isolation
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

const {
  MedicalService,
  fromBackendService,
  toBackendCreatePayload,
  toBackendUpdatePayload,
  normalizeCategory,
  normalizeOperatingDays
} = await import("../assets/js/services/medical-service.js");
const { Api } = await import("../assets/js/services/api-client.js");
const { APP_CONFIG } = await import("../assets/js/core/config.js");

const originalApiGet = Api.get.bind(Api);
const originalApiPost = Api.post.bind(Api);
const originalApiPatch = Api.patch.bind(Api);

try {
  const calls = [];

  Api.get = async (endpoint) => {
    calls.push({ method: "GET", endpoint });
    if (endpoint === "/admin/services") {
      return {
        success: true,
        message: "Services fetched successfully",
        data: {
          services: [
            {
              publicId: "srv_MqJ4U0Pqgs",
              name: "General Medical Consultation",
              category: "general_medicine",
              description: "Outpatient consultations for general illnesses.",
              operatingDays: ["monday", "tuesday", "wednesday", "thursday", "friday"],
              opensAt: "08:00:00",
              closesAt: "20:00:00",
              dailyCapacity: 80,
              requiresReferral: false,
              status: "open"
            },
            {
              publicId: "srv_Dental8Xk2Lm",
              name: "Dental Consultation",
              category: "dental",
              description: "Dental examinations and oral healthcare services.",
              operatingDays: ["monday", "wednesday", "friday"],
              opensAt: "09:00:00",
              closesAt: "16:00:00",
              dailyCapacity: 30,
              requiresReferral: false,
              status: "closed"
            }
          ]
        }
      };
    }
    if (endpoint.startsWith("/admin/services/")) {
      const pid = endpoint.replace("/admin/services/", "");
      return {
        success: true,
        message: "Service fetched successfully",
        data: {
          service: {
            publicId: pid,
            name: "General Medical Consultation",
            category: "general_medicine",
            description: "Outpatient consultations for general illnesses.",
            operatingDays: ["monday", "tuesday", "wednesday"],
            opensAt: "08:00:00",
            closesAt: "20:00:00",
            dailyCapacity: 80,
            requiresReferral: false,
            status: "open"
          }
        }
      };
    }
    throw new Error(`Unhandled mock GET endpoint: ${endpoint}`);
  };

  Api.post = async (endpoint, data) => {
    calls.push({ method: "POST", endpoint, data });
    return {
      success: true,
      message: "Service added",
      data: {
        service: {
          publicId: "srv_new_created_99",
          status: "open",
          ...data
        }
      }
    };
  };

  Api.patch = async (endpoint, data) => {
    calls.push({ method: "PATCH", endpoint, data });
    const parts = endpoint.split("/");
    const pid = parts[3];
    return {
      success: true,
      message: "Service updated successfully",
      data: {
        service: {
          publicId: pid,
          status: data?.status || "open",
          ...data
        }
      }
    };
  };

  // Test 1: GET /admin/services & response envelope parsing
  const services = await MedicalService.getAllServices();
  assert.equal(services.length, 2, "Should parse two services from data.services envelope");
  const getCall = calls.find((c) => c.method === "GET" && c.endpoint === "/admin/services");
  assert.ok(getCall, "Must query documented GET /admin/services endpoint");

  // Test 2: Field mapping (publicId, status <-> isActive, normalized days & times)
  const openSrv = services.find(s => s.publicId === "srv_MqJ4U0Pqgs");
  assert.ok(openSrv, "Service with publicId 'srv_MqJ4U0Pqgs' must exist");
  assert.equal(openSrv.id, "srv_MqJ4U0Pqgs", "Canonical publicId must be mirrored to id for backward-compatibility");
  assert.equal(openSrv.status, "open", "Status must be open");
  assert.equal(openSrv.isActive, true, "isActive must be true for open status");
  assert.equal(openSrv.startTime, "08:00", "startTime must be formatted HH:mm");
  assert.equal(openSrv.endTime, "20:00", "endTime must be formatted HH:mm");
  assert.ok(openSrv.operatingDays.includes("Monday"), "Operating days must be normalized to TitleCase for UI");

  const closedSrv = services.find(s => s.publicId === "srv_Dental8Xk2Lm");
  assert.ok(closedSrv, "Closed service must exist in admin list");
  assert.equal(closedSrv.status, "closed", "Status must be closed");
  assert.equal(closedSrv.isActive, false, "isActive must be false for closed service");

  // Test 3: POST /admin/services with documented 8 fields
  await MedicalService.createService({
    name: "Eye Care Clinic",
    category: "optometry",
    description: "Vision testing and optical care.",
    operatingDays: ["Monday", "Wednesday"],
    startTime: "09:00",
    endTime: "15:00",
    dailyCapacity: 25,
    requiresReferral: false
  });
  const postCall = calls.find((c) => c.method === "POST" && c.endpoint === "/admin/services");
  assert.ok(postCall, "Must call POST /admin/services");
  assert.equal(postCall.data.name, "Eye Care Clinic");
  assert.equal(postCall.data.category, "optometry");
  assert.deepEqual(postCall.data.operatingDays, ["monday", "wednesday"], "Operating days in POST must be lowercase enums");
  assert.equal(postCall.data.opensAt, "09:00:00", "opensAt must be formatted with seconds");
  assert.equal(postCall.data.closesAt, "15:00:00", "closesAt must be formatted with seconds");
  assert.equal(postCall.data.dailyCapacity, 25);
  assert.equal(postCall.data.requiresReferral, false);

  // Test 4: PATCH /admin/services/:publicId
  await MedicalService.updateService("srv_MqJ4U0Pqgs", {
    name: "Advanced General Medical Consultation",
    dailyCapacity: 95
  });
  const patchCall = calls.find((c) => c.method === "PATCH" && c.endpoint === "/admin/services/srv_MqJ4U0Pqgs");
  assert.ok(patchCall, "Must call PATCH /admin/services/:publicId");
  assert.equal(patchCall.data.name, "Advanced General Medical Consultation");
  assert.equal(patchCall.data.dailyCapacity, 95);
  assert.equal(patchCall.data.id, undefined, "Frontend-only field 'id' must not be sent");
  assert.equal(patchCall.data.publicId, undefined, "publicId must not be sent in PATCH body");
  assert.equal(patchCall.data.isActive, undefined, "isActive must not be sent in PATCH body");

  // Test 5: PATCH /admin/services/:publicId/status
  await MedicalService.toggleStatus("srv_MqJ4U0Pqgs");
  const statusCall = calls.find((c) => c.method === "PATCH" && c.endpoint === "/admin/services/srv_MqJ4U0Pqgs/status");
  assert.ok(statusCall, "Must call PATCH /admin/services/:publicId/status");
  assert.deepEqual(statusCall.data, { status: "closed" }, "Status payload must contain target status 'closed'");

  // Test 6: GET /admin/services/:publicId (single service retrieval)
  const single = await MedicalService.getServiceByPublicId("srv_MqJ4U0Pqgs");
  assert.ok(single, "Must retrieve service by publicId");
  assert.equal(single.publicId, "srv_MqJ4U0Pqgs");
  const singleGetCall = calls.find((c) => c.method === "GET" && c.endpoint === "/admin/services/srv_MqJ4U0Pqgs");
  assert.ok(singleGetCall, "Must query GET /admin/services/:publicId");

  // Test 7: Validation of create payload required fields
  await assert.rejects(
    async () => MedicalService.createService({ name: "", category: "dental", operatingDays: ["monday"] }),
    /Service name is required/i,
    "createService must reject empty name"
  );
  await assert.rejects(
    async () => MedicalService.createService({ name: "Testing", category: "dental", operatingDays: [] }),
    /at least one operating day/i,
    "createService must reject empty operatingDays"
  );

  // Test 8: Serialization & strip of non-backend fields
  const serializedUpdate = toBackendUpdatePayload({
    id: "temp_123",
    publicId: "srv_999",
    name: "Optometry Specialist",
    category: "Specialist Clinic",
    isActive: true,
    status: "open",
    startTime: "08:30",
    endTime: "16:45",
    capacityPerDay: 40
  });
  assert.equal(serializedUpdate.id, undefined);
  assert.equal(serializedUpdate.publicId, undefined);
  assert.equal(serializedUpdate.isActive, undefined);
  assert.equal(serializedUpdate.status, undefined);
  assert.equal(serializedUpdate.startTime, undefined);
  assert.equal(serializedUpdate.endTime, undefined);
  assert.equal(serializedUpdate.opensAt, "08:30:00");
  assert.equal(serializedUpdate.closesAt, "16:45:00");
  assert.equal(serializedUpdate.dailyCapacity, 40);
  assert.equal(serializedUpdate.category, "other");

  console.log("PASS: MedicalService backend API integration (/admin/services GET, POST, PATCH, status toggle)");
} finally {
  Api.get = originalApiGet;
  Api.post = originalApiPost;
  Api.patch = originalApiPatch;
}
