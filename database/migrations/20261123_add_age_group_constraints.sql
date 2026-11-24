-- Migration: Add check constraints to enforce min_age >= 6, max_age <= 60, and min_age <= max_age in cst_age_groups
-- Date: 2026-11-23

ALTER TABLE cst_age_groups
    ADD CONSTRAINT chk_cst_age_groups_min_age CHECK (min_age >= 6 AND min_age <= 60),
    ADD CONSTRAINT chk_cst_age_groups_max_age CHECK (max_age >= 6 AND max_age <= 60),
    ADD CONSTRAINT chk_cst_age_groups_range CHECK (min_age <= max_age);
