/*
  Warnings:

  - Added the required column `id_entreprise` to the `role` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `role` ADD COLUMN `id_entreprise` INTEGER NOT NULL;

-- AddForeignKey
ALTER TABLE `role` ADD CONSTRAINT `role_id_entreprise_fkey` FOREIGN KEY (`id_entreprise`) REFERENCES `entreprise`(`id_entreprise`) ON DELETE RESTRICT ON UPDATE CASCADE;
