-- Normalize legacy task priorities before constraining the column.
-- Canonical values used by backend/database/frontend: LOW, MEDIUM, HIGH, URGENT.

UPDATE `tache`
SET `priorite_t` = CASE
  WHEN `priorite_t` IS NULL OR TRIM(`priorite_t`) = '' THEN 'MEDIUM'
  WHEN UPPER(TRIM(`priorite_t`)) IN ('LOW', 'BASSE') THEN 'LOW'
  WHEN UPPER(TRIM(`priorite_t`)) IN ('MEDIUM', 'MOYENNE') THEN 'MEDIUM'
  WHEN UPPER(TRIM(`priorite_t`)) IN ('HIGH', 'HAUTE') THEN 'HIGH'
  WHEN UPPER(TRIM(`priorite_t`)) IN ('URGENT', 'CRITICAL', 'CRITIQUE', 'URGENTE') THEN 'URGENT'
  ELSE 'MEDIUM'
END;

ALTER TABLE `tache`
  MODIFY `priorite_t` ENUM('LOW', 'MEDIUM', 'HIGH', 'URGENT') NULL DEFAULT 'MEDIUM';
