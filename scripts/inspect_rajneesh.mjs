import mysql from 'mysql2/promise';

async function main() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: { rejectUnauthorized: false }
  });

  // Find Rajneesh Kumar
  const [staff] = await connection.query(
    `SELECT s.*, u.id as user_tbl_id, u.first_name, u.last_name, u.appointment_no 
     FROM cst_staff s
     LEFT JOIN cst_users u ON u.id = s.user_id
     WHERE s.appointment_no = 'STF-2026-0005' OR s.first_name LIKE '%Rajneesh%'`
  );

  console.log('Staff record:', staff);

  if (staff.length > 0) {
    const userId = staff[0].user_id;
    const staffId = staff[0].id;

    // Check attendance records for this user
    const [att] = await connection.query(
      `SELECT attendance_date, attendance_status, check_in, check_out, remarks
       FROM cst_attendance 
       WHERE user_id = ?
       ORDER BY attendance_date ASC`,
      [userId]
    );

    console.log(`Attendance count for user_id ${userId}:`, att.length);
    console.log('Attendance breakdown:');
    const counts = {};
    att.forEach(r => {
      counts[r.attendance_status] = (counts[r.attendance_status] || 0) + 1;
      console.log(`  ${r.attendance_date} => ${r.attendance_status}`);
    });
    console.log('Summary status counts:', counts);

    // Check weekly off records for this user
    const [wOff] = await connection.query(
      `SELECT * FROM cst_user_weekly_off WHERE user_id = ?`,
      [userId]
    );
    console.log('Weekly off records:', wOff);

    // Check salary payments record
    const [payments] = await connection.query(
      `SELECT * FROM cst_staff_salary_payments WHERE staff_id = ?`,
      [staffId]
    );
    console.log('Salary payment records:', payments);
  }

  await connection.end();
}

main().catch(console.error);
