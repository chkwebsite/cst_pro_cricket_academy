-- Migration: Make email, phone, and address mandatory (NOT NULL) in cst_branch
-- Date: 2026-11-24

-- 1. Backfill any null or empty values for existing rows
UPDATE cst_branch SET email = 'info@cstacademy.com' WHERE email IS NULL OR TRIM(email) = '';
UPDATE cst_branch SET phone = '0000000000' WHERE phone IS NULL OR TRIM(phone) = '';
UPDATE cst_branch SET address = 'Not Provided' WHERE address IS NULL OR TRIM(address) = '';

-- 2. Modify columns to NOT NULL
ALTER TABLE cst_branch
    MODIFY COLUMN email VARCHAR(150) NOT NULL,
    MODIFY COLUMN phone VARCHAR(20) NOT NULL,
    MODIFY COLUMN address TEXT NOT NULL;
