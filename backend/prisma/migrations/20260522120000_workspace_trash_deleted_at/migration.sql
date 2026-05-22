-- Soft delete (corbeille) for workspace hierarchy
ALTER TABLE `spaces_pm` ADD COLUMN `deleted_at` DATETIME(3) NULL;
ALTER TABLE `projets` ADD COLUMN `deleted_at` DATETIME(3) NULL;
ALTER TABLE `lists_pm` ADD COLUMN `deleted_at` DATETIME(3) NULL;

CREATE INDEX `spaces_pm_deleted_at_idx` ON `spaces_pm`(`deleted_at`);
CREATE INDEX `projets_deleted_at_idx` ON `projets`(`deleted_at`);
CREATE INDEX `lists_pm_deleted_at_idx` ON `lists_pm`(`deleted_at`);
