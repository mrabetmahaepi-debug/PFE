-- AlterTable
ALTER TABLE `invitation` ADD COLUMN `mot_de_passe` VARCHAR(255) NULL,
    ADD COLUMN `nom` VARCHAR(100) NULL,
    ADD COLUMN `prenom` VARCHAR(100) NULL;
