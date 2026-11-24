-- Migration: Prevent duplicate program names for the same academy and branch
-- Date: 2026-11-23

-- Add UNIQUE functional index on (academy_id, COALESCE(branch_id, 0), program_name) in cst_programs
CREATE UNIQUE INDEX IF NOT EXISTS uq_program_academy_branch_name 
    ON cst_programs (academy_id, (COALESCE(branch_id, 0)), program_name);
