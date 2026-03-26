import { useSyncExternalStore } from 'react';

/**
 * Returns true after the component has mounted on the client.
 * Use this to avoid hydration mismatches for theme-dependent UI.
 */
export function useMounted(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}
