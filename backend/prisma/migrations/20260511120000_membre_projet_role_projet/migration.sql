-- Optional display role for each project member (e.g. Développeur, Chef de Projet).
ALTER TABLE `membre_projet` ADD COLUMN `role_projet` VARCHAR(120) NULL;
