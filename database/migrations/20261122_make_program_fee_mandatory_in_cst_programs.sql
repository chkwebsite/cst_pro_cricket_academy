-- Migration: Make program_fee mandatory (NOT NULL with no default) in cst_programs
-- Date: 2026-11-22

ALTER TABLE cst_programs
    MODIFY COLUMN program_fee DECIMAL(10, 2) NOT NULL;
