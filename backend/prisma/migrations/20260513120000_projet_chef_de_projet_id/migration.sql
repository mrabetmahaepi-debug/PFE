-- Chef de projet (FK utilisateur), sans toucher aux données existantes.
ALTER TABLE `projets`
  ADD COLUMN `chef_de_projet_id` INTEGER NULL;

CREATE INDEX `projets_chef_de_projet_id_idx` ON `projets`(`chef_de_projet_id`);

ALTER TABLE `projets`
  ADD CONSTRAINT `projets_chef_de_projet_id_fkey`
  FOREIGN KEY (`chef_de_projet_id`) REFERENCES `utilisateur`(`id_utilisateur`)
  ON DELETE SET NULL ON UPDATE RESTRICT;
