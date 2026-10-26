import { useEffect, RefObject } from 'react';

/**
 * Invokes callback when a click happens outside the referenced elements.
 */
export function useClickOutside(
  refs: RefObject<HTMLElement | null> | Array<RefObject<HTMLElement | null>>,
  onClickOutside: () => void,
  enabled = true
): void {
  useEffect(() => {
    if (!enabled) return;

    const refList = Array.isArray(refs) ? refs : [refs];

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
      if (!target) return;

      const isInside = refList.some((ref) => ref.current && ref.current.contains(target));
      if (!isInside) {
        onClickOutside();
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
    };
  }, [refs, onClickOutside, enabled]);
}

