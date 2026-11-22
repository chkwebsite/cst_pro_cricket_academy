-- Migration: Make gender, dob, speciality, experience, last_salary, date_of_joining, date_of_appointment mandatory (NOT NULL) in cst_staff
-- Date: 2026-11-22

UPDATE cst_staff SET gender = 'other' WHERE gender IS NULL;
UPDATE cst_staff SET dob = '1990-01-01' WHERE dob IS NULL;
UPDATE cst_staff SET speciality = 'Administration' WHERE speciality IS NULL;
UPDATE cst_staff SET experience = 0.0 WHERE experience IS NULL;
UPDATE cst_staff SET last_salary = 0.00 WHERE last_salary IS NULL;
UPDATE cst_staff SET date_of_joining = '2026-01-01' WHERE date_of_joining IS NULL;
UPDATE cst_staff SET date_of_appointment = '2026-01-01' WHERE date_of_appointment IS NULL;

ALTER TABLE cst_staff
    MODIFY COLUMN gender ENUM('male','female','other') NOT NULL,
    MODIFY COLUMN dob DATE NOT NULL,
    MODIFY COLUMN speciality VARCHAR(255) NOT NULL,
    MODIFY COLUMN experience DECIMAL(4,1) NOT NULL,
    MODIFY COLUMN last_salary DECIMAL(10,2) NOT NULL,
    MODIFY COLUMN date_of_joining DATE NOT NULL,
    MODIFY COLUMN date_of_appointment DATE NOT NULL;
