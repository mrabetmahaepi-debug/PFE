-- Align utilisateur with Prisma schema: createdAt, photoUrl (idempotent).

SET @db = DATABASE();

-- createdAt
SET @exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @db
    AND TABLE_NAME = 'utilisateur'
    AND COLUMN_NAME = 'createdAt'
);
SET @sql := IF(
  @exists = 0,
  'ALTER TABLE `utilisateur` ADD COLUMN `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- photoUrl
SET @exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @db
    AND TABLE_NAME = 'utilisateur'
    AND COLUMN_NAME = 'photoUrl'
);
SET @sql := IF(
  @exists = 0,
  'ALTER TABLE `utilisateur` ADD COLUMN `photoUrl` VARCHAR(500) NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
