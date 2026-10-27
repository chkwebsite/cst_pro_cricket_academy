ALTER TABLE cst_ground
    ADD COLUMN branch_id INT NULL AFTER academy_id,
    ADD INDEX idx_cst_ground_branch_id (branch_id);