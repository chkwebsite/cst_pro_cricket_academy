-- Migration: Create tables for player attendance, player program fees, and player payments

CREATE TABLE IF NOT EXISTS cst_player_attendance (
  id INT AUTO_INCREMENT PRIMARY KEY,
  academy_id INT NOT NULL,
  branch_id INT NOT NULL,
  user_program_id INT NOT NULL,
  admission_players_id INT NOT NULL,
  program_id INT NOT NULL,
  attendance_date DATE NOT NULL,
  attendance_status ENUM('Present', 'Absent', 'Late', 'Leave') NOT NULL DEFAULT 'Present',
  remarks TEXT NULL,
  marked_by INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_attendance_user_program_date (user_program_id, attendance_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS cst_player_program_fees (
  id INT AUTO_INCREMENT PRIMARY KEY,
  academy_id INT NOT NULL,
  branch_id INT NOT NULL,
  user_program_id INT NOT NULL,
  admission_players_id INT NOT NULL,
  program_id INT NOT NULL,
  fee_month DATE NOT NULL,
  fee_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  registration_fee DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  daily_fee DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  kit_fee DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  discount_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  late_fee DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  total_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  paid_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  due_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  payment_status ENUM('Pending', 'Partial', 'Paid', 'Cancelled') NOT NULL DEFAULT 'Pending',
  due_date DATE NULL,
  remarks TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_player_program_fee_month (user_program_id, fee_month)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS cst_player_payments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  player_program_fee_id INT NOT NULL,
  receipt_no VARCHAR(100) NOT NULL UNIQUE,
  paid_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  payment_mode ENUM('Cash', 'UPI', 'Card', 'Bank Transfer', 'Cheque') NOT NULL DEFAULT 'Cash',
  transaction_no VARCHAR(100) NULL,
  payment_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  payment_status ENUM('Success', 'Failed', 'Refunded') NOT NULL DEFAULT 'Success',
  remarks TEXT NULL,
  received_by INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
