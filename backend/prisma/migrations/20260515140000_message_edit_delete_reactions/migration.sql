-- Messagerie : édition, suppression (soft), réactions
ALTER TABLE `message`
  ADD COLUMN `editedAt` DATETIME(3) NULL,
  ADD COLUMN `deletedAt` DATETIME(3) NULL;

CREATE TABLE `message_reaction` (
  `id_message_reaction` INT NOT NULL AUTO_INCREMENT,
  `id_message` INT NOT NULL,
  `id_utilisateur` INT NOT NULL,
  `emoji` VARCHAR(32) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id_message_reaction`),
  UNIQUE INDEX `message_reaction_message_user_emoji_key` (`id_message`, `id_utilisateur`, `emoji`),
  INDEX `message_reaction_id_message_idx` (`id_message`),
  INDEX `message_reaction_id_utilisateur_idx` (`id_utilisateur`),
  CONSTRAINT `message_reaction_id_message_fkey` FOREIGN KEY (`id_message`) REFERENCES `message` (`id_message`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `message_reaction_id_utilisateur_fkey` FOREIGN KEY (`id_utilisateur`) REFERENCES `utilisateur` (`id_utilisateur`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
