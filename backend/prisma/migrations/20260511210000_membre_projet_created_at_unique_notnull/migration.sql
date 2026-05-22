-- One row per (projet, utilisateur) with audit field.
DELETE m1 FROM `membre_projet` m1
INNER JOIN `membre_projet` m2
  ON m1.`id_projet` = m2.`id_projet`
  AND m1.`id_utilisateur` = m2.`id_utilisateur`
  AND m1.`id_membre_projet` > m2.`id_membre_projet`;

DELETE FROM `membre_projet` WHERE `id_projet` IS NULL OR `id_utilisateur` IS NULL;

ALTER TABLE `membre_projet` ADD COLUMN `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);

ALTER TABLE `membre_projet` MODIFY `id_projet` INTEGER NOT NULL;
ALTER TABLE `membre_projet` MODIFY `id_utilisateur` INTEGER NOT NULL;

CREATE UNIQUE INDEX `membre_projet_project_user_key` ON `membre_projet` (`id_projet`, `id_utilisateur`);
