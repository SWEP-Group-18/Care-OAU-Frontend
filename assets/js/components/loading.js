/**
 * Care-OAU - Loading State Controller
 * Provides button busy indicators and page/card loading spinners.
 */

export const Loading = {
  /**
   * Set a button into a loading/busy state
   */
  setButtonLoading(button, isLoading = true, loadingText = 'Processing...') {
    if (!button) return;

    if (isLoading) {
      button.dataset.originalText = button.innerHTML;
      button.disabled = true;
      button.classList.add('disabled');
      button.innerHTML = `
        <span class="spinner" style="width: 16px; height: 16px; border-width: 2px;"></span>
        <span>${loadingText}</span>
      `;
    } else {
      button.disabled = false;
      button.classList.remove('disabled');
      if (button.dataset.originalText) {
        button.innerHTML = button.dataset.originalText;
        delete button.dataset.originalText;
      }
    }
  },

  /**
   * Render inline spinner markup
   */
  renderSpinner(text = 'Loading data...') {
    return `
      <div class="empty-state" style="padding: var(--space-8) var(--space-4);">
        <div class="spinner" style="width: 32px; height: 32px; margin-bottom: var(--space-3);"></div>
        <p class="text-sm text-muted">${text}</p>
      </div>
    `;
  }
};
