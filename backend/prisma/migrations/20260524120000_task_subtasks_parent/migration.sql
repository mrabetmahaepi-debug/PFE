-- Subtasks: link child tasks to parent via id_parent_tache
ALTER TABLE `tache` ADD COLUMN `id_parent_tache` INTEGER NULL;

CREATE INDEX `tache_id_parent_tache_idx` ON `tache`(`id_parent_tache`);

ALTER TABLE `tache` ADD CONSTRAINT `tache_id_parent_tache_fkey`
  FOREIGN KEY (`id_parent_tache`) REFERENCES `tache`(`id_tache`)
  ON DELETE CASCADE ON UPDATE RESTRICT;
