const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:3000';
(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ timezoneId: 'Africa/Lagos' });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('https://fonts.googleapis.com/**', route => route.abort());
    await page.clock.install({ time: new Date('2026-10-26T09:00:00Z') });
    await page.goto(base);
    await page.evaluate(() => {
      const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
      const doctor = { serviceId: 'test-service', specialization: 'General Medicine', workingDays: days, startTime: '08:00', endTime: '17:00', dailyCapacity: 8, currentLoad: 0, isAvailable: true };
      localStorage.setItem('care_oau_auth_user', JSON.stringify({ id: 'test-student', name: 'Test Student', role: 'student' }));
      localStorage.setItem('care_oau_services', JSON.stringify([{ id: 'test-service', name: 'Consultation', isActive: true, operatingDays: days, startTime: '08:00', endTime: '17:00', dailyCapacity: 100 }]));
      localStorage.setItem('care_oau_appointments', '[]');
      localStorage.setItem('care_oau_doctors', JSON.stringify([
        { ...doctor, id: 'available', name: 'Dr. Amina Yusuf' },
        { ...doctor, id: 'break', name: 'Dr. On Break', status: 'On Break' },
        { ...doctor, id: 'consultation', name: 'Dr. Consulting', status: 'In Consultation' },
        { ...doctor, id: 'full', name: 'Dr. At Capacity', currentLoad: 8 },
        { ...doctor, id: 'off', name: 'Dr. Next Shift', workingDays: ['Tuesday'] },
        { ...doctor, id: 'leave', name: 'Dr. On Leave', specialization: 'Dental Care', isAvailable: false }
      ]));
    });
    await page.goto(base + '/student/doctors.html');
    const card = id => page.locator(`[data-doctor-id="${id}"]`);
    assert.equal(await page.locator('.availability-card').count(), 6);
    for (const [id, label] of [['available', 'Available'], ['break', 'On Break'], ['consultation', 'In Consultation'], ['full', 'Fully Booked'], ['off', 'Off Duty']]) {
      assert.equal((await card(id).locator('.availability-badge').innerText()).trim(), label);
    }
    assert.equal(await card('available').locator('.availability-slots').innerText(), '8 slots left');
    assert.equal(await card('full').locator('.availability-slots').innerText(), '0 slots left');
    assert.ok(await card('full').locator('button').isDisabled());
    assert.ok((await card('off').innerText()).includes('27 Oct'));
    assert.equal(await card('leave').locator('a').count(), 0);
    for (const id of ['available', 'break', 'consultation']) assert.ok(await card(id).locator('a.button').getAttribute('href'));
    for (const [width, columns] of [[1920, 4], [1440, 3], [1024, 2], [768, 2], [390, 1]]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.waitForFunction(expected => Math.abs(parseFloat(getComputedStyle(document.querySelector('.main-wrapper')).marginLeft) - expected) < 0.1, width <= 820 ? 0 : 248);
      assert.equal(await page.locator('#doctor-list').evaluate(el => getComputedStyle(el).gridTemplateColumns.split(' ').length), columns, `columns at ${width}`);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `overflow at ${width}`);
      assert.ok(await card('available').locator('.availability-details').isVisible());
    }
    await page.selectOption('#filter-specialty', 'Dental Care');
    assert.equal(await page.locator('.availability-card').count(), 1);
    await page.selectOption('#filter-specialty', 'All');
    await page.fill('#filter-date', '2026-10-27');
    await page.dispatchEvent('#filter-date', 'change');
    assert.equal((await card('off').locator('.availability-badge').innerText()).trim(), 'Available');
    assert.equal(await card('full').locator('.availability-slots').innerText(), '8 slots left');
    await card('available').locator('a.button').click();
    await page.waitForURL('**/book-appointment.html?**');
    assert.equal(new URL(page.url()).searchParams.get('doctorId'), 'available');
    assert.equal(new URL(page.url()).searchParams.get('date'), '2026-10-27');
    assert.ok(await page.locator('[data-doctor-id="available"]').evaluate(el => el.classList.contains('selected')));
    await page.goto(base + '/student/doctors.html');
    await page.fill('#filter-date', '');
    await page.dispatchEvent('#filter-date', 'change');
    assert.equal(await page.inputValue('#filter-date'), '2026-10-26');
    await page.evaluate(() => {
      localStorage.setItem('care_oau_doctors', '[]');
      window.dispatchEvent(new StorageEvent('storage', { key: 'care_oau_doctors' }));
    });
    assert.ok(await page.locator('.availability-empty').isVisible());
    assert.deepEqual(errors, []);
    console.log('PASS: five badges, capacity, future dates, filters, empty state, booking preselection, 4/3/2/1 columns, no overflow or console errors.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
