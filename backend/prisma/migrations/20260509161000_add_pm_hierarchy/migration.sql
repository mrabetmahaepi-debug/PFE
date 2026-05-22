-- Phase 3: flexible project management hierarchy (additive only)

CREATE TABLE `groups_pm` (
  `id_group` INTEGER NOT NULL AUTO_INCREMENT,
  `nom` VARCHAR(120) NOT NULL,
  `description` TEXT NULL,
  `color` VARCHAR(24) NULL,
  `position` INTEGER NOT NULL DEFAULT 0,
  `id_projet` INTEGER NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id_group`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `folders_pm` (
  `id_folder` INTEGER NOT NULL AUTO_INCREMENT,
  `nom` VARCHAR(120) NOT NULL,
  `description` TEXT NULL,
  `position` INTEGER NOT NULL DEFAULT 0,
  `id_projet` INTEGER NOT NULL,
  `id_group` INTEGER NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id_folder`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `lists_pm` (
  `id_list` INTEGER NOT NULL AUTO_INCREMENT,
  `nom` VARCHAR(120) NOT NULL,
  `description` TEXT NULL,
  `position` INTEGER NOT NULL DEFAULT 0,
  `id_projet` INTEGER NOT NULL,
  `id_group` INTEGER NULL,
  `id_folder` INTEGER NULL,
  `id_sprint` INTEGER NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id_list`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `sprint`
  ADD COLUMN `id_group` INTEGER NULL,
  ADD COLUMN `id_folder` INTEGER NULL;

ALTER TABLE `tache`
  ADD COLUMN `id_group` INTEGER NULL,
  ADD COLUMN `id_folder` INTEGER NULL,
  ADD COLUMN `id_list` INTEGER NULL;

CREATE INDEX `groups_pm_id_projet_idx` ON `groups_pm`(`id_projet`);
CREATE INDEX `folders_pm_id_projet_idx` ON `folders_pm`(`id_projet`);
CREATE INDEX `folders_pm_id_group_idx` ON `folders_pm`(`id_group`);
CREATE INDEX `lists_pm_id_projet_idx` ON `lists_pm`(`id_projet`);
CREATE INDEX `lists_pm_id_group_idx` ON `lists_pm`(`id_group`);
CREATE INDEX `lists_pm_id_folder_idx` ON `lists_pm`(`id_folder`);
CREATE INDEX `lists_pm_id_sprint_idx` ON `lists_pm`(`id_sprint`);
CREATE INDEX `sprint_id_group_idx` ON `sprint`(`id_group`);
CREATE INDEX `sprint_id_folder_idx` ON `sprint`(`id_folder`);
CREATE INDEX `tache_id_group_idx` ON `tache`(`id_group`);
CREATE INDEX `tache_id_folder_idx` ON `tache`(`id_folder`);
CREATE INDEX `tache_id_list_idx` ON `tache`(`id_list`);

ALTER TABLE `groups_pm`
  ADD CONSTRAINT `groups_pm_id_projet_fkey`
  FOREIGN KEY (`id_projet`) REFERENCES `projets`(`id_projet`) ON DELETE CASCADE ON UPDATE RESTRICT;

ALTER TABLE `folders_pm`
  ADD CONSTRAINT `folders_pm_id_projet_fkey`
  FOREIGN KEY (`id_projet`) REFERENCES `projets`(`id_projet`) ON DELETE CASCADE ON UPDATE RESTRICT,
  ADD CONSTRAINT `folders_pm_id_group_fkey`
  FOREIGN KEY (`id_group`) REFERENCES `groups_pm`(`id_group`) ON DELETE CASCADE ON UPDATE RESTRICT;

ALTER TABLE `lists_pm`
  ADD CONSTRAINT `lists_pm_id_projet_fkey`
  FOREIGN KEY (`id_projet`) REFERENCES `projets`(`id_projet`) ON DELETE CASCADE ON UPDATE RESTRICT,
  ADD CONSTRAINT `lists_pm_id_group_fkey`
  FOREIGN KEY (`id_group`) REFERENCES `groups_pm`(`id_group`) ON DELETE CASCADE ON UPDATE RESTRICT,
  ADD CONSTRAINT `lists_pm_id_folder_fkey`
  FOREIGN KEY (`id_folder`) REFERENCES `folders_pm`(`id_folder`) ON DELETE CASCADE ON UPDATE RESTRICT,
  ADD CONSTRAINT `lists_pm_id_sprint_fkey`
  FOREIGN KEY (`id_sprint`) REFERENCES `sprint`(`id_sprint`) ON DELETE CASCADE ON UPDATE RESTRICT;

ALTER TABLE `sprint`
  ADD CONSTRAINT `sprint_id_group_fkey`
  FOREIGN KEY (`id_group`) REFERENCES `groups_pm`(`id_group`) ON DELETE CASCADE ON UPDATE RESTRICT,
  ADD CONSTRAINT `sprint_id_folder_fkey`
  FOREIGN KEY (`id_folder`) REFERENCES `folders_pm`(`id_folder`) ON DELETE CASCADE ON UPDATE RESTRICT;

ALTER TABLE `tache`
  ADD CONSTRAINT `tache_id_group_fkey`
  FOREIGN KEY (`id_group`) REFERENCES `groups_pm`(`id_group`) ON DELETE CASCADE ON UPDATE RESTRICT,
  ADD CONSTRAINT `tache_id_folder_fkey`
  FOREIGN KEY (`id_folder`) REFERENCES `folders_pm`(`id_folder`) ON DELETE CASCADE ON UPDATE RESTRICT,
  ADD CONSTRAINT `tache_id_list_fkey`
  FOREIGN KEY (`id_list`) REFERENCES `lists_pm`(`id_list`) ON DELETE CASCADE ON UPDATE RESTRICT;
