-- Renseigne chef_de_projet_id depuis l'affectation « chef » (un seul chef par projet attendu).
UPDATE `projets` p
INNER JOIN (
  SELECT a.id_projet, MIN(a.id_affectation) AS id_affectation
  FROM `affectation` a
  WHERE a.id_tache IS NULL
    AND a.role_affectation = 'chef'
    AND a.id_utilisateur IS NOT NULL
  GROUP BY a.id_projet
) pick ON pick.id_projet = p.id_projet
INNER JOIN `affectation` a2 ON a2.id_affectation = pick.id_affectation
SET p.chef_de_projet_id = a2.id_utilisateur
WHERE p.chef_de_projet_id IS NULL;
