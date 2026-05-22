-- Track who created each task; nullable for existing rows.
ALTER TABLE `tache` ADD COLUMN `cree_par` INTEGER NULL;

ALTER TABLE `tache` ADD CONSTRAINT `tache_cree_par_fkey`
  FOREIGN KEY (`cree_par`) REFERENCES `utilisateur`(`id_utilisateur`)
  ON DELETE SET NULL ON UPDATE RESTRICT;
