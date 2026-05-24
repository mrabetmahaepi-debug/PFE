-- CreateTable
CREATE TABLE `admin_recommendation_state` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `id_entreprise` INTEGER NOT NULL,
    `id_utilisateur` INTEGER NOT NULL,
    `recommendation_id` VARCHAR(120) NOT NULL,
    `status` VARCHAR(20) NOT NULL,
    `action_type` VARCHAR(50) NULL,
    `title` VARCHAR(255) NULL,
    `result_summary` TEXT NULL,
    `metadata` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `admin_rec_state_ent_rec_key`(`id_entreprise`, `recommendation_id`),
    INDEX `admin_rec_state_ent_idx`(`id_entreprise`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
