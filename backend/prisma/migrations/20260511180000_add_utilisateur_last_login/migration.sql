-- Last login tracking (idempotent; folder was missing migration.sql and blocked `migrate deploy`).
SET @db = DATABASE();
SET @exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @db
    AND TABLE_NAME = 'utilisateur'
    AND COLUMN_NAME = 'lastLogin'
);
SET @sql := IF(
  @exists = 0,
  'ALTER TABLE `utilisateur` ADD COLUMN `lastLogin` DATETIME(3) NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
