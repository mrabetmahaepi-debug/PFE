/** Max idle time since lastSeen while isOnline is true — user shown as offline after this. */
export const PRESENCE_MAX_IDLE_MS = 120_000;

export function computePresenceOnline(
  isOnline: boolean,
  lastSeen: Date | null | undefined
): boolean {
  if (!isOnline || lastSeen == null) return false;
  return Date.now() - new Date(lastSeen).getTime() < PRESENCE_MAX_IDLE_MS;
}
