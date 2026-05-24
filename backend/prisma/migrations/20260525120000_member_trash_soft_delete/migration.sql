-- Soft delete for member corbeille: tasks, subtasks, sprints, lists

ALTER TABLE `tache`
  ADD COLUMN `deleted_at` DATETIME(3) NULL,
  ADD COLUMN `deleted_by` INT NULL;

ALTER TABLE `tache`
  ADD INDEX `tache_deleted_at_idx` (`deleted_at`),
  ADD INDEX `tache_deleted_by_idx` (`deleted_by`);

ALTER TABLE `sprint`
  ADD COLUMN `deleted_at` DATETIME(3) NULL,
  ADD COLUMN `deleted_by` INT NULL;

ALTER TABLE `sprint`
  ADD INDEX `sprint_deleted_at_idx` (`deleted_at`);

ALTER TABLE `lists_pm`
  ADD COLUMN `deleted_by` INT NULL;
