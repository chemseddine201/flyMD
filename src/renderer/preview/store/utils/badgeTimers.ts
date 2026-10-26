const badgeTimers = new Map<string, ReturnType<typeof setTimeout>>();

export function scheduleBadgeClear(key: string, callback: () => void, delayMs = 5000): void {
  if (badgeTimers.has(key)) {
    return;
  }
  const timer = setTimeout(() => {
    badgeTimers.delete(key);
    callback();
  }, delayMs);
  badgeTimers.set(key, timer);
}

export function cancelBadgeClear(key: string): void {
  const timer = badgeTimers.get(key);
  if (timer) {
    clearTimeout(timer);
    badgeTimers.delete(key);
  }
}
