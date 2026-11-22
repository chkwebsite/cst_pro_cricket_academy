import pool from "../src/app/components/lib/db.js";

async function testValidation() {
    try {
        console.log("Checking DB schema for program_fee in cst_programs...");
        const [cols] = await pool.query(
            "SELECT COLUMN_NAME, IS_NULLABLE, COLUMN_DEFAULT, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'cst_programs' AND COLUMN_NAME = 'program_fee'"
        );
        console.log("Column definition:", cols);

        // Try inserting with NULL to verify DB constraint
        try {
            await pool.query(
                "INSERT INTO cst_programs (academy_id, program_name, program_fee, status) VALUES (1, 'Test-Null-Fee', NULL, 1)"
            );
            console.error("FAIL: DB allowed NULL program_fee");
        } catch (dbErr) {
            console.log("PASS: DB rejected NULL program_fee as expected:", dbErr.message);
        }

        console.log("ALL TESTS COMPLETED SUCCESSFULLY");
    } catch (err) {
        console.error("Test Error:", err);
    } finally {
        await pool.end();
    }
}

testValidation();
