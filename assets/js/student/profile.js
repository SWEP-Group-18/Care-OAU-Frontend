import { Navigation } from '../core/navigation.js';
import { Header } from '../components/header.js';
import { StudentSidebar } from '../components/student-sidebar.js';
import { saveStudentProfile } from '../services/profile-service.js';
import { passwordFormMarkup, bindPasswordForm } from '../components/password-form.js';

document.addEventListener('DOMContentLoaded', () => {
  let user = Navigation.requireAuth('student');
  if (!user) return;
  const editable = ['name', 'email', 'phone'];
  function renderIdentity() {
    Header.render('Student Profile'); StudentSidebar.render();
    document.getElementById('profile-display-name').textContent = user.name;
    document.getElementById('profile-initials').textContent = user.name.split(/\s+/).filter(Boolean).map(part => part[0]).slice(0, 2).join('').toUpperCase();
    editable.forEach(key => { document.getElementById(`profile-${key}`).value = user[key] || ''; });
    document.getElementById('profile-matric').value = user.matricNo || user.hospitalId || '';
    const badge = document.getElementById('profile-verification');
    badge.textContent = user.isVerified ? 'Verified' : 'Not verified';
    badge.className = `badge ${user.isVerified ? 'badge-success' : 'badge-warning'}`;
  }
  function setEditing(editing) {
    editable.forEach(key => { document.getElementById(`profile-${key}`).readOnly = !editing; });
    document.getElementById('profile-actions').classList.toggle('hidden', !editing);
    document.getElementById('edit-profile').classList.toggle('hidden', editing);
  }
  renderIdentity();
  document.getElementById('edit-profile').onclick = () => { setEditing(true); document.getElementById('profile-name').focus(); };
  document.getElementById('cancel-profile').onclick = () => { renderIdentity(); setEditing(false); document.getElementById('profile-feedback').textContent = ''; document.getElementById('edit-profile').focus(); };
  document.getElementById('profile-form').onsubmit = event => {
    event.preventDefault();
    const feedback = document.getElementById('profile-feedback');
    try {
      const result = saveStudentProfile(Object.fromEntries(editable.map(key => [key, document.getElementById(`profile-${key}`).value])));
      user = result.user; renderIdentity(); setEditing(false);
      feedback.textContent = result.emailChanged ? 'Profile saved. Your new email is unverified; email delivery is not connected in this demo.' : 'Profile saved.';
      document.getElementById('edit-profile').focus();
    } catch (error) { feedback.textContent = error.message; }
  };
  document.getElementById('profile-signout').onclick = () => Navigation.logout();
  document.getElementById('student-password-container').innerHTML = passwordFormMarkup('student-password');
  bindPasswordForm('student-password');
});
