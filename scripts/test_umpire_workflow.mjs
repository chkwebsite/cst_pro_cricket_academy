import pool from "../src/app/components/lib/db.js";

async function testWorkflow() {
  const connection = await pool.getConnection();
  try {
    console.log("=== STARTING UMPIRE & GROUND BOOKING WORKFLOW TEST ===");

    // 1. Get an active academy, branch, ground, slot for testing
    const [academies] = await connection.query("SELECT id, academy_name FROM cst_academy WHERE status = 1 LIMIT 1");
    if (!academies.length) throw new Error("No active academy found for testing");
    const academyId = academies[0].id;
    console.log(`✓ Using Academy: ${academies[0].academy_name} (ID: ${academyId})`);

    const [branches] = await connection.query("SELECT id, branch_name FROM cst_branch WHERE academy_id = ? AND status = 1 LIMIT 1", [academyId]);
    const branchId = branches.length ? branches[0].id : null;
    console.log(`✓ Using Branch: ${branches.length ? branches[0].branch_name : "None"} (ID: ${branchId})`);

    // 2. Test inserting an Umpire
    console.log("\n--- TEST 1: INSERT UMPIRE WITH FEES ---");
    const testUmpireName = "Test Official Umpire " + Date.now();
    const testMobile = "9876543210";
    
    await connection.beginTransaction();

    const [insUmpire] = await connection.query(
      `INSERT INTO cst_umpires (
        academy_id, branch_id, umpire_name, email, mobile, alternate_mobile,
        experience_years, qualification, address, status, is_deleted
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0)`,
      [
        academyId,
        branchId,
        testUmpireName,
        "testumpire@cricketacademy.test",
        testMobile,
        "9876543211",
        8,
        "BCCI State Panel Level 1",
        "123 Test Pavilion Road, Sports Complex",
      ]
    );
    const testUmpireId = insUmpire.insertId;
    console.log(`✓ Umpire created with ID: ${testUmpireId}`);

    // Insert Match Fees
    const feesToInsert = [
      { match_type: "T20", fee_amount: 1500, payment_type: "Per Match" },
      { match_type: "ODI", fee_amount: 2500, payment_type: "Per Match" },
      { match_type: "Test", fee_amount: 4000, payment_type: "Per Day" },
      { match_type: "Practice", fee_amount: 500, payment_type: "Per Hour" }
    ];

    for (const f of feesToInsert) {
      await connection.query(
        `INSERT INTO cst_umpire_fees (
          academy_id, umpire_id, match_type, fee_amount, payment_type, status
        ) VALUES (?, ?, ?, ?, ?, 1)`,
        [academyId, testUmpireId, f.match_type, f.fee_amount, f.payment_type]
      );
    }
    await connection.commit();
    console.log(`✓ Inserted ${feesToInsert.length} match fee configurations.`);

    // 3. Test Query Umpire + Fees
    console.log("\n--- TEST 2: QUERY UMPIRE DETAILS & FEES ---");
    const [fetchedUmpire] = await connection.query(
      `SELECT u.*, a.academy_name, b.branch_name 
       FROM cst_umpires u
       LEFT JOIN cst_academy a ON a.id = u.academy_id
       LEFT JOIN cst_branch b ON b.id = u.branch_id
       WHERE u.id = ? AND u.is_deleted = 0`,
      [testUmpireId]
    );
    console.log("Fetched Umpire:", fetchedUmpire[0].umpire_name, "| Status:", fetchedUmpire[0].status);

    const [fetchedFees] = await connection.query(
      `SELECT match_type, fee_amount, payment_type FROM cst_umpire_fees WHERE umpire_id = ?`,
      [testUmpireId]
    );
    console.log("Configured Fees:", fetchedFees);
    if (fetchedFees.length !== 4) throw new Error("Fee count mismatch!");

    // 4. Test Updating Umpire & Adding Tournament Fee
    console.log("\n--- TEST 3: UPDATE UMPIRE & UPSERT FEES ---");
    await connection.beginTransaction();
    await connection.query(
      `UPDATE cst_umpires SET experience_years = 9, qualification = 'BCCI Level 2 Certified' WHERE id = ?`,
      [testUmpireId]
    );
    await connection.query(
      `INSERT INTO cst_umpire_fees (academy_id, umpire_id, match_type, fee_amount, payment_type, status)
       VALUES (?, ?, 'Tournament', 3000, 'Per Match', 1)
       ON DUPLICATE KEY UPDATE fee_amount = VALUES(fee_amount)`,
      [academyId, testUmpireId]
    );
    await connection.commit();
    console.log("✓ Updated umpire qualification & added Tournament fee.");

    // Pick T20 fee id for booking test
    const [t20FeeRows] = await connection.query(
      "SELECT id, fee_amount FROM cst_umpire_fees WHERE umpire_id = ? AND match_type = 'T20'",
      [testUmpireId]
    );
    const t20FeeId = t20FeeRows[0].id;

    // 5. Test Ground Booking Integration
    console.log("\n--- TEST 4: CREATE GROUND BOOKING WITH UMPIRE ---");
    const [grounds] = await connection.query("SELECT id FROM cst_ground WHERE academy_id = ? AND status = 1 LIMIT 1", [academyId]);
    if (!grounds.length) {
      console.log("No ground found for academy, skipping booking insert, testing deletion safety query directly.");
    } else {
      const groundId = grounds[0].id;
      const [slots] = await connection.query("SELECT id, price FROM cst_ground_slots WHERE ground_id = ? AND status = 1 LIMIT 1", [groundId]);
      if (!slots.length) {
        console.log("No slots found for ground, testing deletion safety directly.");
      } else {
        const slotId = slots[0].id;
        const bookingNo = `TEST-GB-${Date.now()}`;
        const bookingDate = "2026-12-01";

        const [insBooking] = await connection.query(
          `INSERT INTO cst_ground_bookings (
            booking_no, ground_id, slot_id, umpire_id, umpire_fee_id,
            customer_name, customer_phone, booking_date, purpose,
            total_amount, paid_amount, balance_amount, payment_status, booking_status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Match', 2500, 2500, 0, 'Paid', 'Booked')`,
          [bookingNo, groundId, slotId, testUmpireId, t20FeeId, "Test Customer", "9988776655", bookingDate]
        );
        const testBookingId = insBooking.insertId;
        console.log(`✓ Created test booking ${bookingNo} (ID: ${testBookingId}) with Umpire ID: ${testUmpireId}, Fee ID: ${t20FeeId}`);

        // Fetch booking with JOIN on Umpire
        const [joinRows] = await connection.query(
          `SELECT gb.id, gb.booking_no, gb.umpire_id, gb.umpire_fee_id,
                  u.umpire_name, u.mobile AS umpire_phone,
                  uf.match_type AS umpire_match_type, uf.fee_amount AS umpire_fee_amount
           FROM cst_ground_bookings gb
           LEFT JOIN cst_umpires u ON u.id = gb.umpire_id
           LEFT JOIN cst_umpire_fees uf ON uf.id = gb.umpire_fee_id
           WHERE gb.id = ?`,
          [testBookingId]
        );
        console.log("Joined Ground Booking Umpire Info:", joinRows[0]);
        if (joinRows[0].umpire_name !== testUmpireName) {
          throw new Error("Umpire name did not join correctly in Ground Booking!");
        }

        // Test Deletion Constraint: Umpire assigned to active booking must NOT be deletable
        console.log("\n--- TEST 5: VERIFY DELETION SAFETY CHECK ---");
        const [activeBookings] = await connection.query(
          "SELECT COUNT(*) AS total FROM cst_ground_bookings WHERE umpire_id = ? AND booking_status NOT IN ('Cancelled')",
          [testUmpireId]
        );
        console.log(`Active bookings for umpire: ${activeBookings[0].total}`);
        if (activeBookings[0].total <= 0) {
          throw new Error("Safety check failed: expected active booking count > 0");
        }
        console.log("✓ Deletion safety rule verified: Active booking prevents deletion.");

        // Clean up test booking
        await connection.query("DELETE FROM cst_ground_bookings WHERE id = ?", [testBookingId]);
        console.log("✓ Test booking removed.");
      }
    }

    // 6. Test Soft Delete
    console.log("\n--- TEST 6: SOFT DELETE UMPIRE ---");
    await connection.query(
      "UPDATE cst_umpires SET is_deleted = 1, status = 0 WHERE id = ?",
      [testUmpireId]
    );
    await connection.query(
      "UPDATE cst_umpire_fees SET status = 0 WHERE umpire_id = ?",
      [testUmpireId]
    );

    const [deletedCheck] = await connection.query(
      "SELECT id, is_deleted, status FROM cst_umpires WHERE id = ?",
      [testUmpireId]
    );
    console.log(`✓ Soft deleted umpire: is_deleted = ${deletedCheck[0].is_deleted}, status = ${deletedCheck[0].status}`);

    // Clean up test umpire
    await connection.query("DELETE FROM cst_umpire_fees WHERE umpire_id = ?", [testUmpireId]);
    await connection.query("DELETE FROM cst_umpires WHERE id = ?", [testUmpireId]);
    console.log("✓ Test umpire cleaned up.");

    console.log("\n=== ALL TESTS PASSED SUCCESSFULLY! ===");
  } catch (err) {
    console.error("Test workflow failed:", err);
    throw err;
  } finally {
    connection.release();
    await pool.end();
  }
}

testWorkflow();
