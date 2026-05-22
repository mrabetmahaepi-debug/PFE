/**
 * Backward-compat wrapper.
 *
 * The real implementation now lives in `./permissions.ts`.
 * Existing imports `import { authorize } from "../middleware/authorize"`
 * keep working unchanged.
 */
import { requirePermission } from "./permissions";

export const authorize = requirePermission;
export { requirePermission, requireAnyPermission, requireSuperAdmin } from "./permissions";
