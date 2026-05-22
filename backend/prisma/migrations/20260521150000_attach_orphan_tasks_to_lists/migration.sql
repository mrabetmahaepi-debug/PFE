-- Ensure default list per sprint and attach orphan tasks (no list) to it
INSERT INTO `lists_pm` (`nom`, `position`, `id_projet`, `id_sprint`, `createdAt`, `updatedAt`)
SELECT 'Liste par défaut', 0, s.`id_projet`, s.`id_sprint`, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)
FROM `sprint` s
WHERE s.`id_projet` IS NOT NULL
AND NOT EXISTS (
  SELECT 1 FROM `lists_pm` l
  WHERE l.`id_sprint` = s.`id_sprint` AND l.`id_projet` = s.`id_projet`
);

UPDATE `tache` t
INNER JOIN `lists_pm` l
  ON l.`id_sprint` = t.`id_sprint`
  AND l.`id_projet` = t.`id_projet`
  AND l.`nom` = 'Liste par défaut'
SET t.`id_list` = l.`id_list`
WHERE t.`id_sprint` IS NOT NULL
  AND (t.`id_list` IS NULL OR t.`id_list` = 0);

-- Project-level orphans: attach to "Général" sprint default list
INSERT INTO `sprint` (`nom_s`, `id_projet`, `statut_s`)
SELECT 'Général', p.`id_projet`, 'active'
FROM `projets` p
WHERE EXISTS (
  SELECT 1 FROM `tache` t
  WHERE t.`id_projet` = p.`id_projet`
    AND (t.`id_sprint` IS NULL OR t.`id_sprint` = 0)
    AND (t.`id_list` IS NULL OR t.`id_list` = 0)
)
AND NOT EXISTS (
  SELECT 1 FROM `sprint` s WHERE s.`id_projet` = p.`id_projet` AND s.`nom_s` = 'Général'
);

INSERT INTO `lists_pm` (`nom`, `position`, `id_projet`, `id_sprint`, `createdAt`, `updatedAt`)
SELECT 'Liste par défaut', 0, s.`id_projet`, s.`id_sprint`, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)
FROM `sprint` s
WHERE s.`nom_s` = 'Général'
AND NOT EXISTS (
  SELECT 1 FROM `lists_pm` l WHERE l.`id_sprint` = s.`id_sprint`
);

UPDATE `tache` t
INNER JOIN `sprint` s ON s.`id_projet` = t.`id_projet` AND s.`nom_s` = 'Général'
INNER JOIN `lists_pm` l ON l.`id_sprint` = s.`id_sprint` AND l.`nom` = 'Liste par défaut'
SET t.`id_sprint` = s.`id_sprint`, t.`id_list` = l.`id_list`
WHERE (t.`id_list` IS NULL OR t.`id_list` = 0);
