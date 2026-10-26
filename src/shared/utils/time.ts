/**
 * Formats a unix timestamp (milliseconds) into a human-readable relative time string.
 */
export function formatRelativeTime(ts: number): string {
  if (!ts || isNaN(ts)) return 'Never';
  const diff = Date.now() - ts;
  if (diff < 0) return 'Just now';
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

