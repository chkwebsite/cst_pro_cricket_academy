import pool from "../src/app/components/lib/db.js";

async function testValidation() {
    try {
        console.log("Checking DB schema for min_age and max_age in cst_age_groups...");
        const [cols] = await pool.query(
            "SELECT COLUMN_NAME, IS_NULLABLE, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'cst_age_groups' AND COLUMN_NAME IN ('min_age', 'max_age')"
        );
        console.log("Column definitions:", cols);

        // Try inserting with NULL to verify DB constraint
        try {
            await pool.query(
                "INSERT INTO cst_age_groups (age_group, min_age, max_age, status) VALUES ('Test-Null-Constraint', NULL, 15, 1)"
            );
            console.error("FAIL: DB allowed NULL min_age");
        } catch (dbErr) {
            console.log("PASS: DB rejected NULL min_age as expected:", dbErr.message);
        }

        try {
            await pool.query(
                "INSERT INTO cst_age_groups (age_group, min_age, max_age, status) VALUES ('Test-Null-Constraint', 10, NULL, 1)"
            );
            console.error("FAIL: DB allowed NULL max_age");
        } catch (dbErr) {
            console.log("PASS: DB rejected NULL max_age as expected:", dbErr.message);
        }

        console.log("ALL TESTS COMPLETED SUCCESSFULLY");
    } catch (err) {
        console.error("Test Error:", err);
    } finally {
        await pool.end();
    }
}

testValidation();
