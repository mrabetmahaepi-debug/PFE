/** Archived projects stay in DB but are hidden from active lists and Mon espace. */
export const PROJECT_ARCHIVED_STATUS = "ARCHIVED";

export function activeProjectStatusFilter() {
  return { NOT: { statut_p: PROJECT_ARCHIVED_STATUS } };
}

export function mergeActiveProjectWhere(
  base: Record<string, unknown>,
  includeArchived?: boolean
): Record<string, unknown> {
  if (includeArchived) return base;
  if (!base || Object.keys(base).length === 0) {
    return activeProjectStatusFilter();
  }
  return { AND: [base, activeProjectStatusFilter()] };
}

export function isProjectArchived(statut_p: string | null | undefined): boolean {
  return String(statut_p ?? "")
    .trim()
    .toUpperCase() === PROJECT_ARCHIVED_STATUS;
}
