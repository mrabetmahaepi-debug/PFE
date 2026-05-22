-- Password reset token fields on utilisateur
ALTER TABLE `utilisateur`
  ADD COLUMN `password_reset_token` VARCHAR(128) NULL,
  ADD COLUMN `password_reset_expires` DATETIME(3) NULL;

CREATE UNIQUE INDEX `utilisateur_password_reset_token_key` ON `utilisateur`(`password_reset_token`);
