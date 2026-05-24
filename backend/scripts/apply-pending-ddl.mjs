/**
 * Apply recent DDL when `prisma migrate` fails (e.g. migration-engine spawn UNKNOWN on Windows).
 * Run from backend/: node scripts/apply-pending-ddl.mjs
 */
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { PrismaClient } from "@prisma/client";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.join(__dirname, "..", "prisma", "migrations");
const prisma = new PrismaClient();

async function columnExists(table, column) {
  const rows = await prisma.$queryRaw`
    SELECT 1 AS ok FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = ${table}
      AND COLUMN_NAME = ${column}
    LIMIT 1
  `;
  return Array.isArray(rows) && rows.length > 0;
}

async function tableExists(table) {
  const rows = await prisma.$queryRaw`
    SELECT 1 AS ok FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = ${table}
    LIMIT 1
  `;
  return Array.isArray(rows) && rows.length > 0;
}

async function migrationApplied(name) {
  const rows = await prisma.$queryRaw`
    SELECT migration_name FROM _prisma_migrations
    WHERE migration_name = ${name}
    LIMIT 1
  `;
  return Array.isArray(rows) && rows.length > 0;
}

async function markMigration(name) {
  if (await migrationApplied(name)) {
    console.log(`  migration record already present: ${name}`);
    return;
  }
  const sqlPath = path.join(migrationsDir, name, "migration.sql");
  const content = fs.readFileSync(sqlPath, "utf8");
  const checksum = crypto.createHash("sha256").update(content).digest("hex");
  await prisma.$executeRawUnsafe(
    `INSERT INTO _prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
     VALUES (UUID(), ?, NOW(3), ?, NULL, NULL, NOW(3), 1)`,
    checksum,
    name
  );
  console.log(`  recorded migration: ${name}`);
}

async function applyInvitationEmailStatus() {
  const name = "20260528120000_invitation_email_status";
  let changed = false;
  if (!(await columnExists("utilisateur", "invitation_email_status"))) {
    await prisma.$executeRawUnsafe(
      "ALTER TABLE `utilisateur` ADD COLUMN `invitation_email_status` VARCHAR(20) NULL"
    );
    console.log("  added utilisateur.invitation_email_status");
    changed = true;
  }
  if (!(await columnExists("invitation", "email_status"))) {
    await prisma.$executeRawUnsafe(
      "ALTER TABLE `invitation` ADD COLUMN `email_status` VARCHAR(20) NULL"
    );
    console.log("  added invitation.email_status");
    changed = true;
  }
  if (changed || !(await migrationApplied(name))) {
    await markMigration(name);
  } else {
    console.log("  invitation email status columns already present");
  }
}

async function applyAdminRecommendationState() {
  const name = "20260526120000_admin_recommendation_state";
  if (await tableExists("admin_recommendation_state")) {
    if (!(await migrationApplied(name))) await markMigration(name);
    return;
  }
  const sql = fs.readFileSync(path.join(migrationsDir, name, "migration.sql"), "utf8");
  for (const stmt of sql.split(/;\s*\n/).map((s) => s.trim()).filter(Boolean)) {
    await prisma.$executeRawUnsafe(stmt);
  }
  console.log("  created admin_recommendation_state");
  await markMigration(name);
}

async function applyUserAccessGrants() {
  const name = "20260527120000_user_access_grants";
  if (await tableExists("utilisateur_access_grants")) {
    if (!(await migrationApplied(name))) await markMigration(name);
    return;
  }
  const sql = fs.readFileSync(path.join(migrationsDir, name, "migration.sql"), "utf8");
  await prisma.$executeRawUnsafe(sql.trim());
  console.log("  created utilisateur_access_grants");
  await markMigration(name);
}

async function main() {
  console.log("Applying pending DDL…");
  await applyInvitationEmailStatus();
  await applyAdminRecommendationState();
  await applyUserAccessGrants();
  console.log("Done.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
