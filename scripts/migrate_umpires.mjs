import pool from "../src/app/components/lib/db.js";

async function migrate() {
  const connection = await pool.getConnection();
  try {
    console.log("Starting migration for Umpire Management Module...");

    // 1. Create cst_umpires
    await connection.query(`
      CREATE TABLE IF NOT EXISTS cst_umpires (
          id INT AUTO_INCREMENT PRIMARY KEY,
          academy_id INT NOT NULL,
          branch_id INT NULL,

          umpire_name VARCHAR(150) NOT NULL,
          email VARCHAR(150) NULL,
          mobile VARCHAR(20) NOT NULL,
          alternate_mobile VARCHAR(20) NULL,

          experience_years INT DEFAULT 0,
          qualification VARCHAR(150) NULL,
          address TEXT NULL,

          status TINYINT NOT NULL DEFAULT 1,
          is_deleted TINYINT NOT NULL DEFAULT 0,

          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
              ON UPDATE CURRENT_TIMESTAMP,

          INDEX idx_umpire_academy (academy_id),
          INDEX idx_umpire_branch (branch_id),

          CONSTRAINT fk_umpire_academy
              FOREIGN KEY (academy_id)
              REFERENCES cst_academy(id)
              ON DELETE RESTRICT ON UPDATE CASCADE,

          CONSTRAINT fk_umpire_branch
              FOREIGN KEY (branch_id)
              REFERENCES cst_branch(id)
              ON DELETE SET NULL ON UPDATE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log("✓ cst_umpires table created or verified.");

    // 2. Create cst_umpire_fees
    await connection.query(`
      CREATE TABLE IF NOT EXISTS cst_umpire_fees (
          id INT AUTO_INCREMENT PRIMARY KEY,

          academy_id INT NOT NULL,
          umpire_id INT NOT NULL,

          match_type ENUM(
              'T20',
              'ODI',
              'Test',
              'Practice',
              'Friendly',
              'Tournament'
          ) NOT NULL,

          fee_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,

          payment_type ENUM(
              'Per Match',
              'Per Day',
              'Per Hour'
          ) NOT NULL DEFAULT 'Per Match',

          status TINYINT NOT NULL DEFAULT 1,

          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
              ON UPDATE CURRENT_TIMESTAMP,

          UNIQUE KEY uq_umpire_match_fee (umpire_id, match_type),
          INDEX idx_umpire_fee_academy (academy_id),

          CONSTRAINT fk_umpire_fee_academy
              FOREIGN KEY (academy_id)
              REFERENCES cst_academy(id)
              ON DELETE RESTRICT ON UPDATE CASCADE,

          CONSTRAINT fk_umpire_fee_umpire
              FOREIGN KEY (umpire_id)
              REFERENCES cst_umpires(id)
              ON DELETE CASCADE ON UPDATE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log("✓ cst_umpire_fees table created or verified.");

    // 3. Create cst_match_umpires
    await connection.query(`
      CREATE TABLE IF NOT EXISTS cst_match_umpires (
          id INT AUTO_INCREMENT PRIMARY KEY,

          academy_id INT NOT NULL,
          branch_id INT NOT NULL,
          match_id INT NOT NULL,
          umpire_id INT NOT NULL,

          umpire_role ENUM(
              'On Field Umpire 1',
              'On Field Umpire 2',
              'Third Umpire',
              'Fourth Umpire'
          ) NOT NULL,

          fee_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,

          payment_status ENUM(
              'Pending',
              'Partial',
              'Paid'
          ) NOT NULL DEFAULT 'Pending',

          remarks TEXT NULL,

          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
              ON UPDATE CURRENT_TIMESTAMP,

          UNIQUE KEY uq_match_umpire_role (match_id, umpire_role),
          INDEX idx_match_umpire_match (match_id),
          INDEX idx_match_umpire_umpire (umpire_id),

          CONSTRAINT fk_match_umpire
              FOREIGN KEY (umpire_id)
              REFERENCES cst_umpires(id)
              ON DELETE RESTRICT ON UPDATE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log("✓ cst_match_umpires table created or verified.");

    // 4. Alter cst_ground_bookings to add umpire_id and umpire_fee_id if not present
    const [cols] = await connection.query(`SHOW COLUMNS FROM cst_ground_bookings`);
    const colNames = cols.map(c => c.Field);
    
    if (!colNames.includes('umpire_id')) {
      console.log("Adding umpire_id to cst_ground_bookings...");
      await connection.query(`
        ALTER TABLE cst_ground_bookings
        ADD COLUMN umpire_id INT NULL AFTER tournament_id,
        ADD CONSTRAINT fk_ground_booking_umpire
            FOREIGN KEY (umpire_id)
            REFERENCES cst_umpires(id)
            ON DELETE SET NULL ON UPDATE CASCADE;
      `);
      console.log("✓ umpire_id column and foreign key added.");
    } else {
      console.log("umpire_id already exists in cst_ground_bookings.");
    }

    if (!colNames.includes('umpire_fee_id')) {
      console.log("Adding umpire_fee_id to cst_ground_bookings...");
      await connection.query(`
        ALTER TABLE cst_ground_bookings
        ADD COLUMN umpire_fee_id INT NULL AFTER umpire_id,
        ADD CONSTRAINT fk_ground_booking_umpire_fee
            FOREIGN KEY (umpire_fee_id)
            REFERENCES cst_umpire_fees(id)
            ON DELETE SET NULL ON UPDATE CASCADE;
      `);
      console.log("✓ umpire_fee_id column and foreign key added.");
    } else {
      console.log("umpire_fee_id already exists in cst_ground_bookings.");
    }

    console.log("Migration completed successfully!");
  } catch (err) {
    console.error("Migration failed:", err);
    throw err;
  } finally {
    connection.release();
    await pool.end();
  }
}

migrate();
