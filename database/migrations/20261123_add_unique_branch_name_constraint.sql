-- Migration: Prevent duplicate branch names within an academy
-- Date: 2026-11-23

-- 1. Remove duplicate branch created on 2026-11-23 if exists
DELETE FROM cst_branch WHERE id = 5;

-- 2. Add UNIQUE constraint on (academy_id, branch_name) in cst_branch
ALTER TABLE cst_branch
    ADD CONSTRAINT uq_branch_name UNIQUE (academy_id, branch_name);
