export interface DeferredAction {
  /** Cancel before the delay elapses. Returns true if it was still pending. */
  cancel: () => boolean;
  /** Promise that resolves when the action runs, or rejects if cancelled. */
  done: Promise<void>;
}

export interface ScheduleDeferredOptions {
  delayMs?: number;
  /** Injectable timers for testing. */
  setTimer?: (fn: () => void, ms: number) => ReturnType<typeof setTimeout>;
  clearTimer?: (handle: ReturnType<typeof setTimeout>) => void;
}

const DEFAULT_DELAY_MS = 5000;

/**
 * Run an action after a delay unless cancelled (undo). This powers
 * undoable bulk actions: nothing is sent to the server until the window
 * elapses, so "Undo" truly prevents the operation rather than reversing it.
 */
export function scheduleDeferredAction(
  run: () => void | Promise<void>,
  options: ScheduleDeferredOptions = {},
): DeferredAction {
  const delayMs = options.delayMs ?? DEFAULT_DELAY_MS;
  const setTimer = options.setTimer ?? ((fn, ms) => setTimeout(fn, ms));
  const clearTimer = options.clearTimer ?? ((h) => clearTimeout(h));

  let settled = false;
  let handle: ReturnType<typeof setTimeout>;
  let rejectDone: (reason?: unknown) => void = () => undefined;

  const done = new Promise<void>((resolve, reject) => {
    rejectDone = reject;
    handle = setTimer(() => {
      if (settled) return;
      settled = true;
      Promise.resolve()
        .then(run)
        .then(resolve, reject);
    }, delayMs);
  });
  // Avoid unhandled rejection noise when callers do not await done.
  done.catch(() => undefined);

  function cancel(): boolean {
    if (settled) return false;
    settled = true;
    clearTimer(handle);
    rejectDone(undefined);
    return true;
  }

  return { cancel, done };
}
