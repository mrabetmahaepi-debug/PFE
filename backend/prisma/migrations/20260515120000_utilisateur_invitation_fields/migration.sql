-- Team invite: pending utilisateur row with secure token (no password until accept).
SET @db = DATABASE();

SET @exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @db
    AND TABLE_NAME = 'utilisateur'
    AND COLUMN_NAME = 'invitation_token'
);
SET @sql := IF(
    @exists = 0,
    'ALTER TABLE `utilisateur` ADD COLUMN `invitation_token` VARCHAR(128) NULL',
    'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @db
    AND TABLE_NAME = 'utilisateur'
    AND COLUMN_NAME = 'invitation_expires'
);
SET @sql := IF(
    @exists = 0,
    'ALTER TABLE `utilisateur` ADD COLUMN `invitation_expires` DATETIME(3) NULL',
    'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @db
    AND TABLE_NAME = 'utilisateur'
    AND COLUMN_NAME = 'invited_by_id'
);
SET @sql := IF(
    @exists = 0,
    'ALTER TABLE `utilisateur` ADD COLUMN `invited_by_id` INT NULL',
    'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @idx := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = @db
    AND TABLE_NAME = 'utilisateur'
    AND INDEX_NAME = 'utilisateur_invitation_token_key'
);
SET @sql := IF(
    @idx = 0,
    'CREATE UNIQUE INDEX `utilisateur_invitation_token_key` ON `utilisateur` (`invitation_token`)',
    'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @fk := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = @db
    AND TABLE_NAME = 'utilisateur'
    AND CONSTRAINT_NAME = 'utilisateur_invited_by_id_fkey'
);
SET @sql := IF(
    @fk = 0,
    'ALTER TABLE `utilisateur` ADD CONSTRAINT `utilisateur_invited_by_id_fkey` FOREIGN KEY (`invited_by_id`) REFERENCES `utilisateur`(`id_utilisateur`) ON DELETE SET NULL ON UPDATE RESTRICT',
    'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
