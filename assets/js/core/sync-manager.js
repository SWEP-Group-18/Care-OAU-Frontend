/**
 * Care-OAU - Real-Time Synchronization Manager
 * Provides 10-second visibility-aware polling loops for student and admin interfaces.
 * Features:
 * - 10-second interval polling while tab is visible
 * - Pauses polling when browser tab is hidden to conserve battery and server bandwidth
 * - Resumes immediately when tab regains focus
 * - Overlap protection (never dispatches concurrent fetches for the same poller)
 * - Immediate refresh trigger on mutations
 * - Clean lifecycle teardown (beforeunload / page navigation)
 */

export const SyncManager = {
  /**
   * Register a managed poller
   * @param {Object} options
   * @param {string} options.name Name identifier for debugging
   * @param {number} [options.interval=10000] Polling interval in ms (default 10s)
   * @param {Function} options.fetchFn Async function returning fresh data
   * @param {Function} options.onData Callback invoked with fresh data
   * @param {Function} [options.onError] Optional callback on network errors
   * @param {boolean} [options.immediate=true] Whether to run immediately on start
   */
  createPoller({
    name = 'unnamed-poller',
    interval = 10000,
    fetchFn,
    onData,
    onError,
    immediate = true
  }) {
    let timerId = null;
    let isFetching = false;
    let isRunning = false;
    let lastSuccessTime = null;

    const execute = async () => {
      if (!isRunning || isFetching) return;
      isFetching = true;

      try {
        const data = await fetchFn();
        lastSuccessTime = Date.now();
        if (typeof onData === 'function') {
          onData(data);
        }
      } catch (err) {
        if (typeof onError === 'function') {
          onError(err, { lastSuccessTime });
        }
      } finally {
        isFetching = false;
      }
    };

    const scheduleNext = () => {
      if (!isRunning) return;
      clearTimeout(timerId);
      timerId = setTimeout(async () => {
        if (typeof document !== 'undefined' && !document.hidden) {
          await execute();
        }
        scheduleNext();
      }, interval);
    };

    const onVisibilityChange = async () => {
      if (typeof document === 'undefined') return;
      if (!document.hidden && isRunning) {
        // Tab became visible again: execute immediately and reschedule
        await execute();
        scheduleNext();
      } else if (document.hidden) {
        // Tab hidden: clear timer to pause
        clearTimeout(timerId);
      }
    };

    const start = () => {
      if (isRunning) return;
      isRunning = true;

      if (typeof document !== 'undefined') {
        document.addEventListener('visibilitychange', onVisibilityChange);
      }
      if (typeof window !== 'undefined') {
        window.addEventListener('beforeunload', stop);
      }

      if (immediate) {
        execute().finally(() => {
          scheduleNext();
        });
      } else {
        scheduleNext();
      }
    };

    const stop = () => {
      isRunning = false;
      clearTimeout(timerId);
      timerId = null;

      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', onVisibilityChange);
      }
      if (typeof window !== 'undefined') {
        window.removeEventListener('beforeunload', stop);
      }
    };

    const trigger = async () => {
      if (!isRunning) return;
      await execute();
      scheduleNext();
    };

    return {
      name,
      start,
      stop,
      trigger,
      isRunning: () => isRunning,
      isFetching: () => isFetching,
      getLastSuccessTime: () => lastSuccessTime
    };
  }
};
