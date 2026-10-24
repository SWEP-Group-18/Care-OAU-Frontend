/**
 * Care-OAU - Dropdown & Multi-Select Controller
 * Handles standard dropdown menus and multi-select components.
 */

export const Dropdown = {
  init() {
    if (this.initialized) return;
    this.initialized = true;
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape') document.querySelectorAll('.dropdown.open').forEach(menu => {
        menu.classList.remove('open'); const button = menu.querySelector('[data-dropdown-toggle]'); button?.setAttribute('aria-expanded', 'false'); button?.focus();
      });
    });
    // Global listener for click outside to close dropdowns
    document.addEventListener('click', (e) => {
      const toggle = e.target.closest('[data-dropdown-toggle]');
      if (toggle) {
        e.preventDefault();
        const parent = toggle.closest('.dropdown');
        if (parent) {
          const open = parent.classList.toggle('open');
          toggle.setAttribute('aria-expanded', String(open));
        }
        return;
      }

      // Close all if clicking outside
      if (!e.target.closest('.dropdown')) {
        document.querySelectorAll('.dropdown.open').forEach(dd => {
          dd.classList.remove('open');
          dd.querySelector('[data-dropdown-toggle]')?.setAttribute('aria-expanded', 'false');
        });
      }
    });
  },

  /**
   * Helper to set up a Monday-Sunday multi-select group
   */
  setupDaySelector(containerId, initialDays = [], onChange = () => {}) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    container.innerHTML = `
      <div class="day-selector-group">
        ${days.map(day => {
          const isChecked = initialDays.includes(day) ? 'checked' : '';
          const isSelected = isChecked ? 'selected' : '';
          return `
            <label class="day-checkbox-label ${isSelected}">
              <input type="checkbox" name="operating_days" value="${day}" ${isChecked}>
              <span>${day.slice(0, 3)}</span>
            </label>
          `;
        }).join('')}
      </div>
    `;

    container.querySelectorAll('input[type="checkbox"]').forEach(input => {
      input.addEventListener('change', () => {
        const label = input.closest('.day-checkbox-label');
        if (input.checked) {
          label.classList.add('selected');
        } else {
          label.classList.remove('selected');
        }
        
        const selected = Array.from(container.querySelectorAll('input:checked')).map(cb => cb.value);
        onChange(selected);
      });
    });
  },

  /**
   * Extract selected days from day-selector-group
   */
  getSelectedDays(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return [];
    return Array.from(container.querySelectorAll('input:checked')).map(cb => cb.value);
  }
};
