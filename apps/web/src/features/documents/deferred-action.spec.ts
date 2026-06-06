import { describe, expect, it, vi } from 'vitest';
import { scheduleDeferredAction } from './deferred-action';

describe('scheduleDeferredAction', () => {
  it('runs the action after the delay when not cancelled', async () => {
    vi.useFakeTimers();
    try {
      const run = vi.fn();
      const action = scheduleDeferredAction(run, { delayMs: 5000 });
      expect(run).not.toHaveBeenCalled();
      vi.advanceTimersByTime(5000);
      await action.done;
      expect(run).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not run the action when cancelled before the delay', async () => {
    vi.useFakeTimers();
    try {
      const run = vi.fn();
      const action = scheduleDeferredAction(run, { delayMs: 5000 });
      const cancelled = action.cancel();
      expect(cancelled).toBe(true);
      vi.advanceTimersByTime(5000);
      await expect(action.done).rejects.toBeUndefined();
      expect(run).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('cancel after the action ran returns false', async () => {
    vi.useFakeTimers();
    try {
      const run = vi.fn();
      const action = scheduleDeferredAction(run, { delayMs: 1000 });
      vi.advanceTimersByTime(1000);
      await action.done;
      expect(action.cancel()).toBe(false);
      expect(run).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('supports injectable timers', () => {
    const timers: Array<() => void> = [];
    const setTimer = vi.fn((fn: () => void) => {
      timers.push(fn);
      return 1 as unknown as ReturnType<typeof setTimeout>;
    });
    const clearTimer = vi.fn();
    const run = vi.fn();

    const action = scheduleDeferredAction(run, { setTimer, clearTimer });
    expect(setTimer).toHaveBeenCalledTimes(1);
    action.cancel();
    expect(clearTimer).toHaveBeenCalledTimes(1);
  });
});
