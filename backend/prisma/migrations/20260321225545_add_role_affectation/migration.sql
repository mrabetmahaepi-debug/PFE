/*
  Warnings:

  - You are about to drop the column `assigne_a` on the `projet` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE `projet` DROP FOREIGN KEY `projet_assigne_a_fkey`;

-- AlterTable
ALTER TABLE `affectation` ADD COLUMN `role_affectation` VARCHAR(191) NULL DEFAULT 'membre';

-- AlterTable
ALTER TABLE `projet` DROP COLUMN `assigne_a`;
