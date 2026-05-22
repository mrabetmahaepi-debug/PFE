CREATE TABLE `list_statuses_pm` (
  `id_status` INT NOT NULL AUTO_INCREMENT,
  `id_list` INT NOT NULL,
  `label` VARCHAR(80) NOT NULL,
  `statut_key` VARCHAR(50) NOT NULL,
  `position` INT NOT NULL DEFAULT 0,
  `is_system` TINYINT(1) NOT NULL DEFAULT 0,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  PRIMARY KEY (`id_status`),
  UNIQUE INDEX `list_statuses_pm_id_list_statut_key_key` (`id_list`, `statut_key`),
  INDEX `list_statuses_pm_id_list_idx` (`id_list`),
  CONSTRAINT `list_statuses_pm_id_list_fkey` FOREIGN KEY (`id_list`) REFERENCES `lists_pm`(`id_list`) ON DELETE CASCADE ON UPDATE RESTRICT
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
