/*
  Warnings:

  - You are about to drop the column `chef_projet_id` on the `projet` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE `projet` DROP FOREIGN KEY `projet_chef_projet_id_fkey`;

-- AlterTable
ALTER TABLE `projet` DROP COLUMN `chef_projet_id`,
    ADD COLUMN `assigne_a` INTEGER NULL;

-- AddForeignKey
ALTER TABLE `projet` ADD CONSTRAINT `projet_assigne_a_fkey` FOREIGN KEY (`assigne_a`) REFERENCES `utilisateur`(`id_utilisateur`) ON DELETE SET NULL ON UPDATE CASCADE;
