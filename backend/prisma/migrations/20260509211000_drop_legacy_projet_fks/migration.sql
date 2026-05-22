-- Drop legacy foreign keys that still point at the old `projet` (singular)
-- table which no longer exists. The current Prisma schema uses
-- `@@map("projets")` for the project model, and the modern FKs
-- (`tache_id_projet_fkey`, `sprint_id_projet_fkey`) already point at
-- `projets`. The orphaned `*_ibfk_1` constraints reference a missing table
-- and silently fail every task / sprint insert with:
--   "Foreign key constraint failed on the field: `id_projet`"
--
-- We cannot use stored procedures / DELIMITER inside Prisma migrations,
-- so each drop is wrapped in a conditional prepared statement that
-- no-ops when the constraint is already gone (idempotent + safe on
-- already-clean databases).

SET @sql_tache := (
  SELECT IF(
    COUNT(*) > 0,
    'ALTER TABLE `tache` DROP FOREIGN KEY `tache_ibfk_1`',
    'SELECT 1'
  )
  FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE()
    AND TABLE_NAME        = 'tache'
    AND CONSTRAINT_NAME   = 'tache_ibfk_1'
    AND CONSTRAINT_TYPE   = 'FOREIGN KEY'
);
SET @sql_tache := IFNULL(@sql_tache, 'SELECT 1');
PREPARE stmt_tache FROM @sql_tache;
EXECUTE stmt_tache;
DEALLOCATE PREPARE stmt_tache;

SET @sql_sprint := (
  SELECT IF(
    COUNT(*) > 0,
    'ALTER TABLE `sprint` DROP FOREIGN KEY `sprint_ibfk_1`',
    'SELECT 1'
  )
  FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE()
    AND TABLE_NAME        = 'sprint'
    AND CONSTRAINT_NAME   = 'sprint_ibfk_1'
    AND CONSTRAINT_TYPE   = 'FOREIGN KEY'
);
SET @sql_sprint := IFNULL(@sql_sprint, 'SELECT 1');
PREPARE stmt_sprint FROM @sql_sprint;
EXECUTE stmt_sprint;
DEALLOCATE PREPARE stmt_sprint;
