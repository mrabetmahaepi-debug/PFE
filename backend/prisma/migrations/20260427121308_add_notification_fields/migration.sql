-- AlterTable
ALTER TABLE `notification` ADD COLUMN `is_read` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `message` TEXT NULL,
    ADD COLUMN `type` VARCHAR(50) NULL DEFAULT 'info',
    MODIFY `date_envoi` DATETIME(3) NULL;
