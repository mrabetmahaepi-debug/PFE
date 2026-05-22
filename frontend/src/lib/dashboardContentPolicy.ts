/** Labels that must never render on the tenant admin dashboard. */
const BLOCKED_DASHBOARD_LABEL =
  /consulter\s+estimation\s+automatique|estimation\s+automatique/i;

export function isBlockedDashboardLabel(
  ...parts: (string | null | undefined)[]
): boolean {
  const text = parts.filter(Boolean).join(" ").trim();
  if (!text) return false;
  return BLOCKED_DASHBOARD_LABEL.test(text);
}

export function filterBlockedDashboardLabels<
  T extends {
    action?: string | null;
    entityLabel?: string | null;
    user?: string | null;
    label?: string | null;
  },
>(items: T[]): T[] {
  return items.filter(
    (item) =>
      !isBlockedDashboardLabel(item.action, item.entityLabel, item.user, item.label)
  );
}
