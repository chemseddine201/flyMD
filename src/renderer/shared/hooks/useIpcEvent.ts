import { useEffect, useRef } from 'react';

/**
 * Subscribes to an IPC event cleanly and guarantees unsubscription on unmount.
 */
export function useIpcEvent<T>(
  subscriber: ((cb: (payload: T) => void) => (() => void) | void) | undefined,
  handler: (payload: T) => void
): void {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    if (typeof subscriber !== 'function') return;
    const unsubscribe = subscriber((payload) => {
      handlerRef.current(payload);
    });
    return () => {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, [subscriber]);
}

