/** Serializes notification creates per eventKey to prevent duplicate INSERT races. */
const inflight = new Map<string, Promise<unknown>>();

export async function withNotificationDedupLock<T>(
  eventKey: string,
  fn: () => Promise<T>
): Promise<T> {
  const pending = inflight.get(eventKey);
  if (pending) {
    return pending as Promise<T>;
  }

  const run = fn().finally(() => {
    if (inflight.get(eventKey) === run) {
      inflight.delete(eventKey);
    }
  });

  inflight.set(eventKey, run);
  return run;
}
