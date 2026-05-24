-- Track transactional email delivery for team invitations.
ALTER TABLE `utilisateur`
  ADD COLUMN `invitation_email_status` VARCHAR(20) NULL;

ALTER TABLE `invitation`
  ADD COLUMN `email_status` VARCHAR(20) NULL;
