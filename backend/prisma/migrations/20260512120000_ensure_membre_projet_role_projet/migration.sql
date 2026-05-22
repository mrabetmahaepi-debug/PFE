-- Ensure `role_projet` exists on `membre_projet` (idempotent).
-- Fixes environments where an earlier migration was skipped or the DB diverged.

SET @db = DATABASE();
SET @exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @db
    AND TABLE_NAME = 'membre_projet'
    AND COLUMN_NAME = 'role_projet'
);
SET @sql := IF(
  @exists = 0,
  'ALTER TABLE `membre_projet` ADD COLUMN `role_projet` VARCHAR(120) NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
