/**
 * Care-OAU - Password Visibility Toggle Unit Test
 * Verifies that password visibility toggles work on admin and student login pages.
 */

import assert from 'node:assert/strict';

// Set up mock DOM environment
const listeners = new Map();
class MockElement {
  constructor(tag = 'div', id = '') {
    this.tagName = tag.toUpperCase();
    this.id = id;
    this.attributes = new Map();
    this.dataset = {};
    this.innerHTML = '';
  }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  setAttribute(name, val) { this.attributes.set(name, String(val)); }
  addEventListener(event, fn) {
    if (!listeners.has(this)) listeners.set(this, []);
    listeners.get(this).push({ event, fn });
  }
  click() {
    const list = listeners.get(this) || [];
    for (const { event, fn } of list) {
      if (event === 'click') fn({ target: this });
    }
  }
}

const mockInput = new MockElement('input', 'test-password');
mockInput.setAttribute('type', 'password');

const mockBtn = new MockElement('button');
mockBtn.setAttribute('data-toggle-password', 'test-password');
mockBtn.setAttribute('aria-label', 'Show password');
mockBtn.innerHTML = '<svg class=eye></svg>';

const elementsById = {
  'test-password': mockInput
};

const mockContainer = {
  querySelectorAll: (selector) => {
    if (selector === '[data-toggle-password]') return [mockBtn];
    return [];
  }
};

globalThis.document = {
  getElementById: (id) => elementsById[id] || null,
  querySelectorAll: (sel) => mockContainer.querySelectorAll(sel)
};

// Import Utils
const { Utils } = await import('../assets/js/core/utils.js');

// Test 1: Initialize toggle
Utils.setupPasswordToggle(mockContainer);
assert.equal(mockBtn.dataset.toggleInitialized, 'true', 'Must mark button as initialized');

// Test 2: Click to show password
mockBtn.click();
assert.equal(mockInput.getAttribute('type'), 'text', 'Password input type must toggle to text');
assert.equal(mockBtn.getAttribute('aria-label'), 'Hide password', 'Button aria-label must update to Hide password');
assert.ok(mockBtn.innerHTML.includes('line'), 'Button must swap to eye-off SVG icon with strike line');

// Test 3: Click again to hide password
mockBtn.click();
assert.equal(mockInput.getAttribute('type'), 'password', 'Password input type must toggle back to password');
assert.equal(mockBtn.getAttribute('aria-label'), 'Show password', 'Button aria-label must update to Show password');
assert.ok(mockBtn.innerHTML.includes('circle'), 'Button must swap back to eye SVG icon');

// Test 4: Idempotency (calling setupPasswordToggle again should not register duplicate listeners)
const listenerCountBefore = (listeners.get(mockBtn) || []).length;
Utils.setupPasswordToggle(mockContainer);
const listenerCountAfter = (listeners.get(mockBtn) || []).length;
assert.equal(listenerCountBefore, listenerCountAfter, 'setupPasswordToggle must be idempotent');

console.log('PASS: Password toggle correctly reveals/masks password, updates aria-labels and swaps icons seamlessly.');
