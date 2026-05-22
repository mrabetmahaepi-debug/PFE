-- Pièces jointes messagerie (images + documents)
ALTER TABLE `message`
  ADD COLUMN `attachmentUrl` VARCHAR(1024) NULL,
  ADD COLUMN `attachmentName` VARCHAR(300) NULL,
  ADD COLUMN `attachmentMime` VARCHAR(128) NULL,
  ADD COLUMN `attachmentSize` INT NULL;
