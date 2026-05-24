const STORAGE_KEY = 'virtide:last-alert-check';
const MIN_INTERVAL_MS = 60_000;

/** Avoid duplicate POST /alerts/check from StrictMode or rapid dashboard remounts. */
export function shouldRunAlertCheck(): boolean {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    const last = raw ? Number(raw) : 0;
    if (Number.isFinite(last) && Date.now() - last < MIN_INTERVAL_MS) {
      return false;
    }
    sessionStorage.setItem(STORAGE_KEY, String(Date.now()));
    return true;
  } catch {
    return true;
  }
}
