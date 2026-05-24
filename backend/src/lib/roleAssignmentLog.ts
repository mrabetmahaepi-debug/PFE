/**
 * Debug logging for global role vs project poste assignment flows.
 */
export function logRoleAssignment(
  context: string,
  data: {
    selectedRole?: string | null;
    savedRole?: string | null;
    loadedRole?: string | null;
    globalRoleNom?: string | null;
    poste?: string | null;
    userId?: number;
    email?: string | null;
  }
): void {
  console.info(`[roleAssignment:${context}]`, {
    selectedRole: data.selectedRole ?? null,
    savedRole: data.savedRole ?? null,
    loadedRole: data.loadedRole ?? null,
    globalRoleNom: data.globalRoleNom ?? null,
    poste: data.poste ?? null,
    userId: data.userId ?? null,
    email: data.email ?? null,
  });
}
