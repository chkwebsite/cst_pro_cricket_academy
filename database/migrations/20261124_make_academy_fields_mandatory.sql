-- Migration: Make Contact Person, Email, Phone, Address, City and State mandatory in cst_academy
-- Date: 2026-11-24

ALTER TABLE cst_academy
    MODIFY COLUMN contact_person VARCHAR(150) NOT NULL,
    MODIFY COLUMN email VARCHAR(150) NOT NULL,
    MODIFY COLUMN phone VARCHAR(20) NOT NULL,
    MODIFY COLUMN address TEXT NOT NULL,
    MODIFY COLUMN city VARCHAR(100) NOT NULL,
    MODIFY COLUMN state VARCHAR(100) NOT NULL;
