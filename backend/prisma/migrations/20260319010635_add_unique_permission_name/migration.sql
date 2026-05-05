/*
  Warnings:

  - A unique constraint covering the columns `[nom]` on the table `Permission` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE `permission` MODIFY `nom` VARCHAR(191) NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX `Permission_nom_key` ON `Permission`(`nom`);
