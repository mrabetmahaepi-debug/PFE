-- Drop the remaining legacy foreign keys that still target the dropped
-- `projet` (singular) table. The previous migration cleaned up
-- `tache_ibfk_1` / `sprint_ibfk_1`; this one finishes the cleanup for
-- `affectation`, `ia_engine`, and `membre_projet`. Each of these orphan
-- constraints causes inserts to fail with:
--   "Foreign key constraint failed on the field: `id_projet`"
-- even though the modern Prisma-managed FK pointing at `projets`
-- already exists alongside it.
--
-- All drops are wrapped in conditional prepared statements so the
-- migration is idempotent and safe on a database that was already
-- cleaned up manually.

SET @sql_aff := (
  SELECT IF(
    COUNT(*) > 0,
    'ALTER TABLE `affectation` DROP FOREIGN KEY `affectation_ibfk_2`',
    'SELECT 1'
  )
  FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE()
    AND TABLE_NAME        = 'affectation'
    AND CONSTRAINT_NAME   = 'affectation_ibfk_2'
    AND CONSTRAINT_TYPE   = 'FOREIGN KEY'
);
SET @sql_aff := IFNULL(@sql_aff, 'SELECT 1');
PREPARE stmt_aff FROM @sql_aff;
EXECUTE stmt_aff;
DEALLOCATE PREPARE stmt_aff;

SET @sql_ia := (
  SELECT IF(
    COUNT(*) > 0,
    'ALTER TABLE `ia_engine` DROP FOREIGN KEY `ia_engine_ibfk_1`',
    'SELECT 1'
  )
  FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE()
    AND TABLE_NAME        = 'ia_engine'
    AND CONSTRAINT_NAME   = 'ia_engine_ibfk_1'
    AND CONSTRAINT_TYPE   = 'FOREIGN KEY'
);
SET @sql_ia := IFNULL(@sql_ia, 'SELECT 1');
PREPARE stmt_ia FROM @sql_ia;
EXECUTE stmt_ia;
DEALLOCATE PREPARE stmt_ia;

SET @sql_mp := (
  SELECT IF(
    COUNT(*) > 0,
    'ALTER TABLE `membre_projet` DROP FOREIGN KEY `membre_projet_ibfk_2`',
    'SELECT 1'
  )
  FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE()
    AND TABLE_NAME        = 'membre_projet'
    AND CONSTRAINT_NAME   = 'membre_projet_ibfk_2'
    AND CONSTRAINT_TYPE   = 'FOREIGN KEY'
);
SET @sql_mp := IFNULL(@sql_mp, 'SELECT 1');
PREPARE stmt_mp FROM @sql_mp;
EXECUTE stmt_mp;
DEALLOCATE PREPARE stmt_mp;
