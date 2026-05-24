-- Task comments and field history (member task details)
CREATE TABLE `tache_comment` (
    `id_comment` INTEGER NOT NULL AUTO_INCREMENT,
    `id_tache` INTEGER NOT NULL,
    `id_utilisateur` INTEGER NOT NULL,
    `contenu` TEXT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `tache_comment_id_tache_idx`(`id_tache`),
    INDEX `tache_comment_id_utilisateur_idx`(`id_utilisateur`),
    PRIMARY KEY (`id_comment`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `tache_history` (
    `id_history` INTEGER NOT NULL AUTO_INCREMENT,
    `id_tache` INTEGER NOT NULL,
    `id_utilisateur` INTEGER NULL,
    `field_key` VARCHAR(50) NOT NULL,
    `old_value` TEXT NULL,
    `new_value` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `tache_history_id_tache_idx`(`id_tache`),
    INDEX `tache_history_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id_history`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `tache_comment` ADD CONSTRAINT `tache_comment_id_tache_fkey` FOREIGN KEY (`id_tache`) REFERENCES `tache`(`id_tache`) ON DELETE CASCADE ON UPDATE RESTRICT;
ALTER TABLE `tache_comment` ADD CONSTRAINT `tache_comment_id_utilisateur_fkey` FOREIGN KEY (`id_utilisateur`) REFERENCES `utilisateur`(`id_utilisateur`) ON DELETE CASCADE ON UPDATE RESTRICT;

ALTER TABLE `tache_history` ADD CONSTRAINT `tache_history_id_tache_fkey` FOREIGN KEY (`id_tache`) REFERENCES `tache`(`id_tache`) ON DELETE CASCADE ON UPDATE RESTRICT;
ALTER TABLE `tache_history` ADD CONSTRAINT `tache_history_id_utilisateur_fkey` FOREIGN KEY (`id_utilisateur`) REFERENCES `utilisateur`(`id_utilisateur`) ON DELETE SET NULL ON UPDATE RESTRICT;
