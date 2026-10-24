import { Storage } from '../core/storage.js';
import { APP_CONFIG } from '../core/config.js';
import { Utils } from '../core/utils.js';

export function saveStudentProfile({ name, email, phone }) {
  const user = Storage.get(APP_CONFIG.STORAGE_KEYS.AUTH_USER);
  if (user?.role !== 'student') throw new Error('Please sign in to edit your student profile.');
  name = name.trim(); email = email.trim().toLowerCase(); phone = phone.trim();
  if (!name || name.length > 100) throw new Error('Enter your full name (up to 100 characters).');
  if (!Utils.isValidEmail(email)) throw new Error('Enter a valid email address.');
  if (!Utils.isValidPhone(phone)) throw new Error('Enter a valid Nigerian phone number.');
  const emailChanged = email !== (user.email || '').toLowerCase();
  // Identity, registration number, role and verification cannot be supplied by the form.
  const updated = { ...user, name, email, phone, isVerified: emailChanged ? false : Boolean(user.isVerified) };
  const accounts = Storage.get('care_oau_demo_accounts', []).filter(account => account.id !== user.id);
  if (accounts.some(account => account.email?.toLowerCase() === email)) throw new Error('That email belongs to another demo account.');
  if (!Storage.set('care_oau_demo_accounts', [...accounts, updated])) throw new Error('Unable to save your profile.');
  Storage.set(APP_CONFIG.STORAGE_KEYS.AUTH_USER, updated);
  return { user: updated, emailChanged };
}
