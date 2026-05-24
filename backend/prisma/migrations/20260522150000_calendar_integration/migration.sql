-- CreateTable
CREATE TABLE `calendar_integration` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `id_utilisateur` INTEGER NOT NULL,
    `provider` VARCHAR(20) NOT NULL,
    `access_token` TEXT NOT NULL,
    `refresh_token` TEXT NULL,
    `expires_at` DATETIME(3) NULL,
    `account_email` VARCHAR(255) NULL,
    `calendar_id` VARCHAR(255) NULL,
    `connected_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `calendar_integration_user_provider_key`(`id_utilisateur`, `provider`),
    INDEX `calendar_integration_id_utilisateur_idx`(`id_utilisateur`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `calendar_integration` ADD CONSTRAINT `calendar_integration_id_utilisateur_fkey` FOREIGN KEY (`id_utilisateur`) REFERENCES `utilisateur`(`id_utilisateur`) ON DELETE CASCADE ON UPDATE RESTRICT;
