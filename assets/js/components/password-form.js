// Shared demo-only form: validate locally; never save or claim to change a password.
export function passwordFormMarkup(prefix) {
  return `<form id="${prefix}-form" class="account-password-form">
    <p class="text-sm text-muted">Demo only. Use sample values. Password changes require a secure backend; no passwords are stored or changed here.</p>
    <div class="form-group"><label class="form-label" for="${prefix}-current">Current password</label><input class="form-control" type="password" id="${prefix}-current" autocomplete="current-password" required></div>
    <div class="form-group"><label class="form-label" for="${prefix}-new">New password</label><input class="form-control" type="password" id="${prefix}-new" autocomplete="new-password" minlength="8" required aria-describedby="${prefix}-hint"><small id="${prefix}-hint">Use at least 8 characters.</small></div>
    <div class="form-group"><label class="form-label" for="${prefix}-confirm">Confirm new password</label><input class="form-control" type="password" id="${prefix}-confirm" autocomplete="new-password" required></div>
    <p id="${prefix}-feedback" role="status" class="text-sm"></p><button class="btn btn-teal" type="submit">Validate password change (demo)</button>
  </form>`;
}
export function bindPasswordForm(prefix) {
  const form = document.getElementById(`${prefix}-form`);
  form.addEventListener('submit', event => {
    event.preventDefault();
    const current = document.getElementById(`${prefix}-current`);
    const next = document.getElementById(`${prefix}-new`);
    const confirm = document.getElementById(`${prefix}-confirm`);
    const feedback = document.getElementById(`${prefix}-feedback`);
    if (next.value !== confirm.value) { feedback.textContent = 'The new passwords do not match.'; confirm.focus(); return; }
    if (current.value === next.value) { feedback.textContent = 'Choose a different new password.'; next.focus(); return; }
    form.reset();
    feedback.textContent = 'Demo validation passed. No password was changed. Secure password updates will be available when the backend is connected.';
  });
}
