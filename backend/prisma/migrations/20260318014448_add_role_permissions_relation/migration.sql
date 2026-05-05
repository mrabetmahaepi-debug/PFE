/*
  Warnings:

  - You are about to drop the `_rolepermissions` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE `_rolepermissions` DROP FOREIGN KEY `_RolePermissions_A_fkey`;

-- DropForeignKey
ALTER TABLE `_rolepermissions` DROP FOREIGN KEY `_RolePermissions_B_fkey`;

-- DropTable
DROP TABLE `_rolepermissions`;

-- CreateTable
CREATE TABLE `_PermissionTorole` (
    `A` INTEGER NOT NULL,
    `B` INTEGER NOT NULL,

    UNIQUE INDEX `_PermissionTorole_AB_unique`(`A`, `B`),
    INDEX `_PermissionTorole_B_index`(`B`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `_PermissionTorole` ADD CONSTRAINT `_PermissionTorole_A_fkey` FOREIGN KEY (`A`) REFERENCES `Permission`(`id_permission`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_PermissionTorole` ADD CONSTRAINT `_PermissionTorole_B_fkey` FOREIGN KEY (`B`) REFERENCES `role`(`id_role`) ON DELETE CASCADE ON UPDATE CASCADE;
