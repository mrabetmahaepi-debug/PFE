-- Add invitation token, expiration and audit fields (additive only)
ALTER TABLE `invitation`
  ADD COLUMN `token` VARCHAR(128) NULL,
  ADD COLUMN `expires_at` DATETIME(3) NULL,
  ADD COLUMN `accepted_at` DATETIME(3) NULL,
  ADD COLUMN `id_invited_by` INT NULL,
  ADD COLUMN `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);

CREATE UNIQUE INDEX `invitation_token_key` ON `invitation`(`token`);
CREATE INDEX `invitation_accepted_at_idx` ON `invitation`(`accepted_at`);