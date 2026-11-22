-- Migration: Make min_age and max_age mandatory (NOT NULL) in cst_age_groups
-- Date: 2026-11-22

ALTER TABLE cst_age_groups
    MODIFY COLUMN min_age INT NOT NULL,
    MODIFY COLUMN max_age INT NOT NULL;
