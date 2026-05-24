/**
 * Quick sanity check for project role → permission mapping.
 * Run: npx tsx src/scripts/verify-project-permissions.ts
 */
import {
  getDefaultPermissionsForProjectRole,
  normalizeProjectRoleBucket,
} from "../lib/projectRolePermissions";

const cases: Array<{ label: string; expectCreate: boolean; bucket: string }> = [
  { label: "Développeur", expectCreate: true, bucket: "DEVELOPPEUR" },
  { label: "Developer", expectCreate: true, bucket: "DEVELOPPEUR" },
  { label: "Chef de Projet", expectCreate: true, bucket: "CHEF" },
  { label: "Project Manager", expectCreate: true, bucket: "CHEF" },
  { label: "Membre", expectCreate: false, bucket: "MEMBRE" },
  { label: "Analyste", expectCreate: false, bucket: "ANALYSTE" },
];

let failed = 0;
for (const c of cases) {
  const bucket = normalizeProjectRoleBucket(c.label);
  const perms = getDefaultPermissionsForProjectRole(c.label);
  const hasCreate =
    perms.has("create_tasks") &&
    perms.has("create_sprints") &&
    perms.has("manage_sprints");
  const bucketOk = bucket === c.bucket;
  const createOk = hasCreate === c.expectCreate;
  if (!bucketOk || !createOk) {
    failed++;
    console.error(
      `FAIL ${c.label}: bucket=${bucket} (want ${c.bucket}), create=${hasCreate} (want ${c.expectCreate})`
    );
  } else {
    console.log(`OK ${c.label}`);
  }
}

if (failed > 0) {
  console.error(`\n${failed} case(s) failed`);
  process.exit(1);
}
console.log("\nAll permission mapping checks passed.");
