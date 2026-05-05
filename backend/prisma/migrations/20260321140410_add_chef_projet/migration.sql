/*
  Warnings:

  - A unique constraint covering the columns `[chef_projet_id]` on the table `projet` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE `projet` ADD COLUMN `chef_projet_id` INTEGER NULL;

-- CreateIndex
CREATE UNIQUE INDEX `projet_chef_projet_id_key` ON `projet`(`chef_projet_id`);

-- AddForeignKey
ALTER TABLE `projet` ADD CONSTRAINT `projet_chef_projet_id_fkey` FOREIGN KEY (`chef_projet_id`) REFERENCES `utilisateur`(`id_utilisateur`) ON DELETE SET NULL ON UPDATE CASCADE;
