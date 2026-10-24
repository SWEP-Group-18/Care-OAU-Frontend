/**
 * Care-OAU - My Appointments page (demo data only, no backend).
 */
import { StudentSidebar } from '../components/student-sidebar.js';
import { Header } from '../components/header.js';

const STATUS = {
  'Pending Approval': { cls: 'pending', note: 'Your request is awaiting staff review. Your queue number will be issued at reception after approval.' },
  'Approved': { cls: 'approved', note: 'Your appointment is approved. Report to reception on the day to check in and receive your queue number.' },
  'Completed': { cls: 'completed', note: 'This visit has been completed.' },
  'Rejected': { cls: 'rejected', note: '' },
  'Cancelled': { cls: 'cancelled', note: 'You cancelled this appointment.' }
};
const TABS = { upcoming: ['Pending Approval', 'Approved'], past: ['Completed'], cancelled: ['Cancelled', 'Rejected'] };
const EMPTY = {
  upcoming: ['No upcoming appointments', 'Book an appointment and it will appear here.'],
  past: ['No past visits yet', 'Completed visits will be listed here.'],
  cancelled: ['Nothing cancelled or rejected', 'Cancelled and rejected requests will show here.']
};

// Fictional demo records
let appointments = [
  { id: 'CHC-45283759', service: 'General Medical Consultation', status: 'Pending Approval', date: '2026-10-27', time: '12:00 PM', doctor: 'Dr. O. A. Adeleke', location: 'Care-OAU Health Centre' },
  { id: 'CHC-45290112', service: 'Vaccination', status: 'Approved', date: '2026-10-29', time: '10:30 AM', doctor: 'Dr. F. Adeyemi', location: 'Care-OAU Health Centre' },
  { id: 'CHC-45177840', service: 'Blood Test', status: 'Completed', date: '2026-10-12', time: '09:00 AM', doctor: 'Dr. F. Adeyemi', location: 'Care-OAU Laboratory' },
  { id: 'CHC-45201336', service: 'X-Ray', status: 'Rejected', date: '2026-10-20', time: '02:00 PM', doctor: 'Dr. I. Musa', location: 'Care-OAU Radiology Unit', reason: 'A doctor referral is required. Book a general consultation first.' }
];
let filter = 'upcoming';
let pendingId = null;

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const parts = (iso) => {
  const d = new Date(iso + 'T12:00:00');
  return {
    day: d.getDate(),
    month: d.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }),
    weekday: d.toLocaleDateString('en-GB', { weekday: 'long' }),
    full: d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  };
};

function render() {
  const list = $('appointments-list');
  const items = appointments.filter((a) => TABS[filter].includes(a.status));
  if (!items.length) {
    const [title, text] = EMPTY[filter];
    list.innerHTML = `<div class="ma-empty"><h3>${title}</h3><p>${text}</p></div>`;
    return;
  }
  list.innerHTML = items.map((a) => {
    const s = STATUS[a.status];
    const p = parts(a.date);
    const note = a.status === 'Rejected' ? `Reason: ${esc(a.reason || 'No reason was given.')}` : s.note;
    const canCancel = TABS.upcoming.includes(a.status);
    return `
    <article class="ma-card">
      <div class="ma-card-top">
        <div>
          <span class="ma-badge ${s.cls}">${a.status}</span>
          <h2>${esc(a.service)}</h2>
          <p class="ma-ref">Booking reference - ${esc(a.id)}</p>
        </div>
        <div class="ma-date"><strong>${p.day}</strong><span>${p.month}<br>${p.weekday}</span></div>
      </div>
      <dl class="ma-meta">
        <div><dt>Scheduled time</dt><dd>${a.time}</dd></div>
        <div><dt>Doctor</dt><dd>${esc(a.doctor)}</dd></div>
        <div><dt>Location</dt><dd>${esc(a.location)}</dd></div>
      </dl>
      <p class="ma-note ${s.cls}">${note}</p>
      <div class="ma-actions">
        <button type="button" class="ma-btn" data-action="details" data-id="${a.id}">View details</button>
        ${canCancel ? `<button type="button" class="ma-link-danger" data-action="cancel" data-id="${a.id}">Cancel appointment</button>` : ''}
      </div>
    </article>`;
  }).join('');
}

function showMessage(text) {
  const m = $('ma-message');
  m.textContent = text;
  m.hidden = false;
}

function openDetails(a) {
  const p = parts(a.date);
  const rows = [['Booking reference', a.id], ['Status', a.status], ['Service', a.service], ['Doctor', a.doctor], ['Date', p.full], ['Time', a.time], ['Location', a.location]];
  if (a.status === 'Rejected') rows.push(['Reason', a.reason || 'No reason was given.']);
  $('details-body').innerHTML = rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join('');
  $('details-dialog').showModal();
}

function openCancel(a) {
  pendingId = a.id;
  $('cancel-text').textContent = `Cancel your ${a.service} appointment on ${parts(a.date).full}? This cannot be undone.`;
  $('cancel-dialog').showModal();
}

function init() {
  try {
    StudentSidebar.render();
    Header.render('My Appointments');
  } catch (err) {
    console.warn('Shared sidebar/header could not render:', err);
  }

  $('appointment-status-tabs').addEventListener('click', (e) => {
    const btn = e.target.closest('.tab-filter-btn');
    if (!btn) return;
    document.querySelectorAll('.tab-filter-btn').forEach((b) => {
      const on = b === btn;
      b.classList.toggle('active', on);
      b.setAttribute('aria-selected', on);
    });
    filter = btn.dataset.filter;
    $('ma-message').hidden = true;
    render();
  });

  $('appointments-list').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const a = appointments.find((x) => x.id === btn.dataset.id);
    if (!a) return;
    btn.dataset.action === 'details' ? openDetails(a) : openCancel(a);
  });

  $('details-close').addEventListener('click', () => $('details-dialog').close());
  $('cancel-back').addEventListener('click', () => { pendingId = null; $('cancel-dialog').close(); });
  $('cancel-confirm').addEventListener('click', () => {
    const a = appointments.find((x) => x.id === pendingId);
    if (a) {
      a.status = 'Cancelled';
      showMessage(`Your ${a.service} appointment (${a.id}) has been cancelled.`);
    }
    pendingId = null;
    $('cancel-dialog').close();
    render();
  });
  // Clicking the dark backdrop closes a dialog without changing anything
  document.querySelectorAll('.ma-dialog').forEach((d) => d.addEventListener('click', (e) => { if (e.target === d) d.close(); }));

  render();
}

document.addEventListener('DOMContentLoaded', init);