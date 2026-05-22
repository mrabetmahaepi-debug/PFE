-- Custom tenant discussions: metadata + scoping (Réunion Admins stays is_system, id_entreprise NULL)
ALTER TABLE `conversation`
  ADD COLUMN `description` TEXT NULL,
  ADD COLUMN `id_entreprise` INTEGER NULL,
  ADD COLUMN `created_by_id` INTEGER NULL;

CREATE INDEX `conversation_id_entreprise_idx` ON `conversation`(`id_entreprise`);
CREATE INDEX `conversation_created_by_id_idx` ON `conversation`(`created_by_id`);

ALTER TABLE `conversation`
  ADD CONSTRAINT `conversation_id_entreprise_fkey`
    FOREIGN KEY (`id_entreprise`) REFERENCES `entreprise`(`id_entreprise`)
    ON DELETE SET NULL ON UPDATE RESTRICT;

ALTER TABLE `conversation`
  ADD CONSTRAINT `conversation_created_by_id_fkey`
    FOREIGN KEY (`created_by_id`) REFERENCES `utilisateur`(`id_utilisateur`)
    ON DELETE SET NULL ON UPDATE RESTRICT;
