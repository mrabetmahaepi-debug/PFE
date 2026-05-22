-- Matrice permissions par rôle dans les projets (par entreprise)
CREATE TABLE `entreprise_project_role_config` (
    `id_entreprise` INTEGER NOT NULL,
    `config_json` JSON NULL,
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    PRIMARY KEY (`id_entreprise`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `entreprise_project_role_config`
ADD CONSTRAINT `entreprise_project_role_config_id_entreprise_fkey`
FOREIGN KEY (`id_entreprise`) REFERENCES `entreprise`(`id_entreprise`)
ON DELETE CASCADE ON UPDATE RESTRICT;
