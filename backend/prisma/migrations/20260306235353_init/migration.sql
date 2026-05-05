-- CreateTable
CREATE TABLE `affectation` (
    `id_affectation` INTEGER NOT NULL AUTO_INCREMENT,
    `id_utilisateur` INTEGER NULL,
    `id_projet` INTEGER NULL,
    `id_tache` INTEGER NULL,
    `date_affectation` DATE NULL DEFAULT (curdate()),
    `statut` VARCHAR(50) NULL DEFAULT 'active',

    INDEX `projet_id`(`id_projet`),
    INDEX `tache_id`(`id_tache`),
    INDEX `utilisateur_id`(`id_utilisateur`),
    PRIMARY KEY (`id_affectation`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `attribution_badge` (
    `id_badge` INTEGER NOT NULL,
    `id_affectation` INTEGER NULL,
    `date_attribution` DATE NULL DEFAULT (curdate()),

    INDEX `affectation_id`(`id_affectation`),
    PRIMARY KEY (`id_badge`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `chatbot` (
    `id_chatbot` INTEGER NOT NULL AUTO_INCREMENT,
    `id_utilisateur` INTEGER NULL,
    `message` TEXT NULL,
    `reponse` TEXT NULL,
    `date_msg` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `utilisateur_id`(`id_utilisateur`),
    PRIMARY KEY (`id_chatbot`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `entreprise` (
    `id_entreprise` INTEGER NOT NULL AUTO_INCREMENT,
    `nom` VARCHAR(100) NULL,
    `adresse` VARCHAR(255) NULL,
    `createdAt` VARCHAR(20) NULL,

    PRIMARY KEY (`id_entreprise`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ia_engine` (
    `id_ia` INTEGER NOT NULL AUTO_INCREMENT,
    `id_projet` INTEGER NULL,

    INDEX `projet_id`(`id_projet`),
    PRIMARY KEY (`id_ia`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `invitation` (
    `id_invitation` INTEGER NOT NULL,
    `email` VARCHAR(150) NULL,
    `id_entreprise` INTEGER NULL,
    `id_role` INTEGER NULL,

    INDEX `entreprise_id`(`id_entreprise`),
    INDEX `role_id`(`id_role`),
    PRIMARY KEY (`id_invitation`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `membre_projet` (
    `id_membre_projet` INTEGER NOT NULL,
    `id_utilisateur` INTEGER NULL,
    `id_projet` INTEGER NULL,

    INDEX `projet_id`(`id_projet`),
    INDEX `utilisateur_id`(`id_utilisateur`),
    PRIMARY KEY (`id_membre_projet`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `notification` (
    `num_notification` INTEGER NOT NULL AUTO_INCREMENT,
    `sujet` VARCHAR(255) NULL,
    `date_envoi` DATE NULL,
    `id_utilisateur` INTEGER NULL,

    INDEX `utilisateur_id`(`id_utilisateur`),
    PRIMARY KEY (`num_notification`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `projet` (
    `id_projet` INTEGER NOT NULL AUTO_INCREMENT,
    `nom_p` VARCHAR(100) NULL,
    `date_debut` DATE NULL,
    `date_fin` DATE NULL,
    `description_p` TEXT NULL,
    `statut_p` VARCHAR(50) NULL,
    `id_entreprise` INTEGER NULL,

    INDEX `entreprise_id`(`id_entreprise`),
    PRIMARY KEY (`id_projet`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `role` (
    `id_role` INTEGER NOT NULL,
    `nom` VARCHAR(100) NULL,
    `description` TEXT NULL,
    `dateCreation` DATE NULL,

    PRIMARY KEY (`id_role`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sprint` (
    `id_sprint` INTEGER NOT NULL AUTO_INCREMENT,
    `nom_s` VARCHAR(100) NULL,
    `date_debut_s` DATE NULL,
    `date_fin_s` DATE NULL,
    `statut_s` VARCHAR(50) NULL,
    `id_projet` INTEGER NULL,

    INDEX `projet_id`(`id_projet`),
    PRIMARY KEY (`id_sprint`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tache` (
    `id_tache` INTEGER NOT NULL AUTO_INCREMENT,
    `nom_t` VARCHAR(100) NULL,
    `description_t` TEXT NULL,
    `date_debut_t` DATE NULL,
    `date_limite_t` DATE NULL,
    `date_fin_t` DATE NULL,
    `statut_t` VARCHAR(50) NULL,
    `priorite_t` VARCHAR(50) NULL,
    `id_projet` INTEGER NULL,
    `id_sprint` INTEGER NULL,
    `assigne_a` INTEGER NULL,

    INDEX `assigne_a`(`assigne_a`),
    INDEX `projet_id`(`id_projet`),
    INDEX `sprint_id`(`id_sprint`),
    PRIMARY KEY (`id_tache`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `utilisateur` (
    `id_utilisateur` INTEGER NOT NULL AUTO_INCREMENT,
    `nom` VARCHAR(100) NULL,
    `prenom` VARCHAR(100) NULL,
    `email` VARCHAR(150) NULL,
    `password` VARCHAR(255) NULL,
    `id_role` INTEGER NULL,
    `id_entreprise` INTEGER NULL,
    `poste` VARCHAR(100) NULL,
    `telephone` VARCHAR(20) NULL,

    UNIQUE INDEX `email`(`email`),
    INDEX `entreprise_id`(`id_entreprise`),
    INDEX `role_id`(`id_role`),
    PRIMARY KEY (`id_utilisateur`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `affectation` ADD CONSTRAINT `affectation_ibfk_1` FOREIGN KEY (`id_utilisateur`) REFERENCES `utilisateur`(`id_utilisateur`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `affectation` ADD CONSTRAINT `affectation_ibfk_2` FOREIGN KEY (`id_projet`) REFERENCES `projet`(`id_projet`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `affectation` ADD CONSTRAINT `affectation_ibfk_3` FOREIGN KEY (`id_tache`) REFERENCES `tache`(`id_tache`) ON DELETE SET NULL ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `attribution_badge` ADD CONSTRAINT `attribution_badge_ibfk_1` FOREIGN KEY (`id_affectation`) REFERENCES `affectation`(`id_affectation`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `chatbot` ADD CONSTRAINT `chatbot_ibfk_1` FOREIGN KEY (`id_utilisateur`) REFERENCES `utilisateur`(`id_utilisateur`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `ia_engine` ADD CONSTRAINT `ia_engine_ibfk_1` FOREIGN KEY (`id_projet`) REFERENCES `projet`(`id_projet`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `invitation` ADD CONSTRAINT `invitation_ibfk_1` FOREIGN KEY (`id_entreprise`) REFERENCES `entreprise`(`id_entreprise`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `invitation` ADD CONSTRAINT `invitation_ibfk_2` FOREIGN KEY (`id_role`) REFERENCES `role`(`id_role`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `membre_projet` ADD CONSTRAINT `membre_projet_ibfk_1` FOREIGN KEY (`id_utilisateur`) REFERENCES `utilisateur`(`id_utilisateur`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `membre_projet` ADD CONSTRAINT `membre_projet_ibfk_2` FOREIGN KEY (`id_projet`) REFERENCES `projet`(`id_projet`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `notification` ADD CONSTRAINT `notification_ibfk_1` FOREIGN KEY (`id_utilisateur`) REFERENCES `utilisateur`(`id_utilisateur`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `projet` ADD CONSTRAINT `projet_ibfk_1` FOREIGN KEY (`id_entreprise`) REFERENCES `entreprise`(`id_entreprise`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `sprint` ADD CONSTRAINT `sprint_ibfk_1` FOREIGN KEY (`id_projet`) REFERENCES `projet`(`id_projet`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `tache` ADD CONSTRAINT `tache_ibfk_1` FOREIGN KEY (`id_projet`) REFERENCES `projet`(`id_projet`) ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `tache` ADD CONSTRAINT `tache_ibfk_2` FOREIGN KEY (`id_sprint`) REFERENCES `sprint`(`id_sprint`) ON DELETE SET NULL ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `tache` ADD CONSTRAINT `tache_ibfk_3` FOREIGN KEY (`assigne_a`) REFERENCES `utilisateur`(`id_utilisateur`) ON DELETE SET NULL ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `utilisateur` ADD CONSTRAINT `utilisateur_ibfk_1` FOREIGN KEY (`id_role`) REFERENCES `role`(`id_role`) ON DELETE SET NULL ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `utilisateur` ADD CONSTRAINT `utilisateur_ibfk_2` FOREIGN KEY (`id_entreprise`) REFERENCES `entreprise`(`id_entreprise`) ON DELETE CASCADE ON UPDATE RESTRICT;
