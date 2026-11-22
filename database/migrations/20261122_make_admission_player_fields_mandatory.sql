-- Migration: Make email, phone, address, under_age, age_group_id, aadhaar_no mandatory (NOT NULL) in cst_admission_players
-- Date: 2026-11-22

-- 1. Add age_group_id if it does not exist
ALTER TABLE cst_admission_players
    ADD COLUMN IF NOT EXISTS age_group_id INT NOT NULL DEFAULT 1 AFTER under_age;

-- 2. Add index for age_group_id
ALTER TABLE cst_admission_players
    ADD INDEX IF NOT EXISTS idx_player_age_group (age_group_id);

-- 3. Drop default from age_group_id so it is strictly mandatory
ALTER TABLE cst_admission_players
    ALTER COLUMN age_group_id DROP DEFAULT;

-- 4. Backfill any null or empty values
UPDATE cst_admission_players SET email = 'player@example.com' WHERE email IS NULL OR TRIM(email) = '';
UPDATE cst_admission_players SET phone = '0000000000' WHERE phone IS NULL OR TRIM(phone) = '';
UPDATE cst_admission_players SET address = 'Not Provided' WHERE address IS NULL OR TRIM(address) = '';
UPDATE cst_admission_players SET under_age = 0 WHERE under_age IS NULL;
UPDATE cst_admission_players SET aadhaar_no = '000000000000' WHERE aadhaar_no IS NULL OR TRIM(aadhaar_no) = '';

-- 5. Modify columns to NOT NULL
ALTER TABLE cst_admission_players
    MODIFY COLUMN email VARCHAR(150) NOT NULL,
    MODIFY COLUMN phone VARCHAR(20) NOT NULL,
    MODIFY COLUMN address TEXT NOT NULL,
    MODIFY COLUMN under_age TINYINT NOT NULL,
    MODIFY COLUMN age_group_id INT NOT NULL,
    MODIFY COLUMN aadhaar_no VARCHAR(20) NOT NULL;
