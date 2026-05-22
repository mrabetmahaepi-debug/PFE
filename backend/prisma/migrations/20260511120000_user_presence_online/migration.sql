-- Presence / online tracking for team status
ALTER TABLE `utilisateur`
  ADD COLUMN `isOnline` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `lastSeen` DATETIME(3) NULL;
