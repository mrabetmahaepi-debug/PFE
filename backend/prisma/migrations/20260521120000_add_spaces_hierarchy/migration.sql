-- Spaces: top-level container under entreprise (replaces workspace layer in product UX)
CREATE TABLE `spaces_pm` (
  `id_space` INT NOT NULL AUTO_INCREMENT,
  `nom` VARCHAR(120) NOT NULL,
  `description` TEXT NULL,
  `position` INT NOT NULL DEFAULT 0,
  `id_entreprise` INT NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id_space`),
  INDEX `spaces_pm_id_entreprise_idx` (`id_entreprise`),
  CONSTRAINT `spaces_pm_id_entreprise_fkey` FOREIGN KEY (`id_entreprise`) REFERENCES `entreprise` (`id_entreprise`) ON DELETE CASCADE ON UPDATE RESTRICT
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `projets` ADD COLUMN `id_space` INT NULL;
CREATE INDEX `projets_id_space_idx` ON `projets`(`id_space`);
ALTER TABLE `projets` ADD CONSTRAINT `projets_id_space_fkey` FOREIGN KEY (`id_space`) REFERENCES `spaces_pm` (`id_space`) ON DELETE SET NULL ON UPDATE RESTRICT;

-- Default space per enterprise
INSERT INTO `spaces_pm` (`nom`, `position`, `id_entreprise`, `updatedAt`)
SELECT 'Espace principal', 0, e.`id_entreprise`, CURRENT_TIMESTAMP(3)
FROM `entreprise` e;

UPDATE `projets` p
INNER JOIN `spaces_pm` s ON s.`id_entreprise` = p.`id_entreprise` AND s.`nom` = 'Espace principal'
SET p.`id_space` = s.`id_space`
WHERE p.`id_entreprise` IS NOT NULL AND p.`id_space` IS NULL;

-- Folders become sprints (Sprint Folder layer)
INSERT INTO `sprint` (`nom_s`, `id_projet`, `statut_s`, `id_folder`)
SELECT f.`nom`, f.`id_projet`, 'active', f.`id_folder`
FROM `folders_pm` f
WHERE NOT EXISTS (
  SELECT 1 FROM `sprint` s
  WHERE s.`id_projet` = f.`id_projet` AND s.`id_folder` = f.`id_folder`
);

-- Lists under folders → attach to matching sprint
UPDATE `lists_pm` l
INNER JOIN `sprint` s ON s.`id_folder` = l.`id_folder` AND s.`id_projet` = l.`id_projet`
SET l.`id_sprint` = s.`id_sprint`
WHERE l.`id_folder` IS NOT NULL AND (l.`id_sprint` IS NULL OR l.`id_sprint` = 0);

-- Orphan lists at project root → default sprint per project
INSERT INTO `sprint` (`nom_s`, `id_projet`, `statut_s`)
SELECT 'Général', p.`id_projet`, 'active'
FROM `projets` p
WHERE EXISTS (
  SELECT 1 FROM `lists_pm` l
  WHERE l.`id_projet` = p.`id_projet` AND (l.`id_sprint` IS NULL OR l.`id_sprint` = 0)
)
AND NOT EXISTS (
  SELECT 1 FROM `sprint` s WHERE s.`id_projet` = p.`id_projet` AND s.`nom_s` = 'Général'
);

UPDATE `lists_pm` l
INNER JOIN `sprint` s ON s.`id_projet` = l.`id_projet` AND s.`nom_s` = 'Général'
SET l.`id_sprint` = s.`id_sprint`
WHERE l.`id_sprint` IS NULL OR l.`id_sprint` = 0;

-- Detach sprints from legacy folder/group anchors (keep rows, flat under project)
UPDATE `sprint` SET `id_folder` = NULL, `id_group` = NULL WHERE `id_folder` IS NOT NULL OR `id_group` IS NOT NULL;

UPDATE `lists_pm` SET `id_folder` = NULL, `id_group` = NULL WHERE `id_folder` IS NOT NULL OR `id_group` IS NOT NULL;

UPDATE `tache` SET `id_folder` = NULL, `id_group` = NULL WHERE `id_folder` IS NOT NULL OR `id_group` IS NOT NULL;
