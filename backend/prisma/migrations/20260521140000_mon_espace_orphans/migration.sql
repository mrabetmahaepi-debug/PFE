-- Rename default space and attach orphan projects to "Mon espace"
INSERT INTO `spaces_pm` (`nom`, `position`, `id_entreprise`, `updatedAt`)
SELECT 'Mon espace', 0, e.`id_entreprise`, CURRENT_TIMESTAMP(3)
FROM `entreprise` e
WHERE NOT EXISTS (
  SELECT 1 FROM `spaces_pm` s
  WHERE s.`id_entreprise` = e.`id_entreprise`
);

UPDATE `spaces_pm` SET `nom` = 'Mon espace' WHERE `nom` = 'Espace principal';

UPDATE `projets` p
INNER JOIN `spaces_pm` s ON s.`id_entreprise` = p.`id_entreprise` AND s.`nom` = 'Mon espace'
SET p.`id_space` = s.`id_space`
WHERE p.`id_entreprise` IS NOT NULL AND (p.`id_space` IS NULL OR p.`id_space` = 0);
