import { useState, useCallback, useRef } from 'react';

/**
 * Copies text to clipboard and tracks a transient `copied` boolean state.
 */
export function useCopyToClipboard(durationMs = 2000) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const copy = useCallback(
    async (text: string): Promise<boolean> => {
      try {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
          setCopied(false);
        }, durationMs);
        return true;
      } catch (err) {
        console.warn('Clipboard copy failed:', err);
        return false;
      }
    },
    [durationMs]
  );

  return { copied, copy };
}

