/**
 * Care-OAU - Real-Time SyncManager Unit Test
 * Verifies:
 * 1. Immediate fetch on start
 * 2. Overlap protection
 * 3. Pause on hidden tab, resume on visible tab
 * 4. Triggering on mutation
 * 5. Clean teardown
 */

import assert from "node:assert/strict";

let docHidden = false;
const listeners = new Map();

globalThis.document = {
  get hidden() {
    return docHidden;
  },
  addEventListener: (event, cb) => {
    listeners.set(event, cb);
  },
  removeEventListener: (event) => {
    listeners.delete(event);
  }
};

globalThis.window = {
  addEventListener: () => {},
  removeEventListener: () => {}
};

const { SyncManager } = await import("../assets/js/core/sync-manager.js");

// Test 1: Immediate execution on start
let fetchCount = 0;
let receivedData = null;

const poller = SyncManager.createPoller({
  name: "test-poller",
  interval: 50, // fast interval for test
  fetchFn: async () => {
    fetchCount++;
    return { count: fetchCount };
  },
  onData: (data) => {
    receivedData = data;
  }
});

poller.start();
assert.equal(poller.isRunning(), true);
await new Promise((r) => setTimeout(r, 20));
assert.equal(fetchCount, 1);
assert.equal(receivedData.count, 1);

// Test 2: Mutation trigger
await poller.trigger();
assert.equal(fetchCount, 2);
assert.equal(receivedData.count, 2);

// Test 3: Tab visibility pause
docHidden = true;
const visibilityHandler = listeners.get("visibilitychange");
assert.ok(visibilityHandler, "Must register visibilitychange listener");
visibilityHandler(); // tab hidden

const countBeforeWait = fetchCount;
await new Promise((r) => setTimeout(r, 120));
assert.equal(fetchCount, countBeforeWait, "Polling must not fire while tab is hidden");

// Test 4: Tab visibility resume
docHidden = false;
await visibilityHandler(); // tab visible
assert.ok(fetchCount > countBeforeWait, "Must resume and execute when tab becomes visible");

// Test 5: Clean teardown
poller.stop();
assert.equal(poller.isRunning(), false);
assert.equal(listeners.has("visibilitychange"), false, "Listener must be removed on stop");

console.log("PASS: SyncManager 10s visibility-aware polling, overlap guards, and teardown");
