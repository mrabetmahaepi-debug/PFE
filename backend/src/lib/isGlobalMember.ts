/** True when user is a global Membre (not Super Admin / Admin entreprise). */
export function isGlobalMemberUser(user: {
  role?: string | null;
}): boolean {
  const role = String(user.role ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "_");
  if (!role) return false;
  if (
    role === "SUPER_ADMIN" ||
    role === "SUPERADMIN" ||
    role === "ADMIN_ENTREPRISE" ||
    role === "ADMIN" ||
    role === "ADMINISTRATEUR"
  ) {
    return false;
  }
  return role === "MEMBRE" || role === "MEMBER";
}
