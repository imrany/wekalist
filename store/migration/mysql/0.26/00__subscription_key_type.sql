ALTER TABLE `subscription` ADD COLUMN `keys`JSON NOT NULL;

UPDATE `subscription` SET `keys` = '{}';


