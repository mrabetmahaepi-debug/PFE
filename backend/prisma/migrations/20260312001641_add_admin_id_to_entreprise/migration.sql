/*
  Warnings:

  - A unique constraint covering the columns `[admin_id]` on the table `entreprise` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE `utilisateur` DROP FOREIGN KEY `utilisateur_ibfk_2`;

-- AlterTable
ALTER TABLE `entreprise` ADD COLUMN `admin_id` INTEGER NULL;

-- CreateIndex
CREATE UNIQUE INDEX `entreprise_admin_id_key` ON `entreprise`(`admin_id`);

-- AddForeignKey
ALTER TABLE `entreprise` ADD CONSTRAINT `entreprise_admin_id_fkey` FOREIGN KEY (`admin_id`) REFERENCES `utilisateur`(`id_utilisateur`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `utilisateur` ADD CONSTRAINT `utilisateur_id_entreprise_fkey` FOREIGN KEY (`id_entreprise`) REFERENCES `entreprise`(`id_entreprise`) ON DELETE SET NULL ON UPDATE CASCADE;
