-- Admin-managed user access grants and denials
CREATE TABLE `utilisateur_access_grants` (
  `id_grant` INT NOT NULL AUTO_INCREMENT,
  `id_utilisateur` INT NOT NULL,
  `id_entreprise` INT NOT NULL,
  `resource_type` VARCHAR(32) NOT NULL,
  `resource_id` INT NULL,
  `feature_key` VARCHAR(80) NULL,
  `effect` VARCHAR(10) NOT NULL DEFAULT 'GRANT',
  `role_projet` VARCHAR(120) NULL,
  `granted_by_id` INT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id_grant`),
  INDEX `utilisateur_access_grants_user_ent_idx` (`id_utilisateur`, `id_entreprise`),
  INDEX `utilisateur_access_grants_resource_idx` (`resource_type`, `resource_id`),
  CONSTRAINT `utilisateur_access_grants_user_fkey` FOREIGN KEY (`id_utilisateur`) REFERENCES `utilisateur`(`id_utilisateur`) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT `utilisateur_access_grants_granted_by_fkey` FOREIGN KEY (`granted_by_id`) REFERENCES `utilisateur`(`id_utilisateur`) ON DELETE SET NULL ON UPDATE RESTRICT
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
