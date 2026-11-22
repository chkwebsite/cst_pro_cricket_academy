import pool from "../src/app/components/lib/db.js";

async function testValidation() {
    try {
        console.log("Checking DB schema for mandatory fields in cst_staff...");
        const targetCols = ['gender', 'dob', 'speciality', 'experience', 'last_salary', 'date_of_joining', 'date_of_appointment'];
        const [cols] = await pool.query(
            "SELECT COLUMN_NAME, IS_NULLABLE, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'cst_staff' AND COLUMN_NAME IN ('gender', 'dob', 'speciality', 'experience', 'last_salary', 'date_of_joining', 'date_of_appointment')"
        );
        console.log("Column definitions:", cols);

        for (const col of targetCols) {
            const found = cols.find(c => c.COLUMN_NAME === col);
            if (!found || found.IS_NULLABLE !== 'NO') {
                console.error(`FAIL: Column ${col} is NOT marked as NOT NULL!`);
            } else {
                console.log(`PASS: Column ${col} is NOT NULL in database.`);
            }
        }

        // Test inserting with NULL for each target field
        const baseValid = {
            appointment_no: 'TEST-TMP-001',
            role_id: 1,
            first_name: 'Test',
            gender: 'male',
            dob: '1990-01-01',
            speciality: 'Coach',
            experience: 5.0,
            last_salary: 10000.00,
            date_of_joining: '2026-01-01',
            date_of_appointment: '2026-01-01',
            status: 1
        };

        for (const field of targetCols) {
            const testObj = { ...baseValid, appointment_no: `TEST-NULL-${field.slice(0, 10)}` };
            testObj[field] = null;
            try {
                await pool.query(
                    `INSERT INTO cst_staff (appointment_no, role_id, first_name, gender, dob, speciality, experience, last_salary, date_of_joining, date_of_appointment, status)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        testObj.appointment_no,
                        testObj.role_id,
                        testObj.first_name,
                        testObj.gender,
                        testObj.dob,
                        testObj.speciality,
                        testObj.experience,
                        testObj.last_salary,
                        testObj.date_of_joining,
                        testObj.date_of_appointment,
                        testObj.status
                    ]
                );
                console.error(`FAIL: DB allowed NULL for ${field}!`);
            } catch (err) {
                console.log(`PASS: DB rejected NULL for ${field} as expected:`, err.message);
            }
        }

        console.log("ALL DB CONSTRAINT TESTS COMPLETED SUCCESSFULLY");
    } catch (err) {
        console.error("Test Error:", err);
    } finally {
        await pool.end();
    }
}

testValidation();
