import { NextResponse } from "next/server";
import pool from "@/app/components/lib/db";


// ============================================
// Helper: Validate YYYY-MM-DD
// ============================================
function isValidDate(date) {
    if (typeof date !== "string") return false;

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return false;
    }

    const parsedDate = new Date(`${date} T00:00:00.000Z`);

    return (
        !Number.isNaN(parsedDate.getTime()) &&
        parsedDate.toISOString().slice(0, 10) === date
    );
}

// ============================================
// Helper: Validate Numeric Amount
// ============================================
function isValidAmount(value) {
    return (
        value !== null &&
        value !== undefined &&
        value !== "" &&
        Number.isFinite(Number(value)) &&
        Number(value) >= 0
    );
}

// ============================================
// Helper: Calculate Fee Amounts
// ============================================
function calculateFeeAmounts({
    fee_amount,
    registration_fee = 0,
    daily_fee = 0,
    kit_fee = 0,
    discount_amount = 0,
    late_fee = 0
}) {
    const fee = Number(fee_amount);
    const registration = Number(registration_fee);
    const daily = Number(daily_fee);
    const kit = Number(kit_fee);
    const discount = Number(discount_amount);
    const late = Number(late_fee);

    const subtotal = fee + registration + daily + kit;

    if (discount > subtotal) {
        return null;
    }

    const total = subtotal - discount + late;

    return {
        fee_amount: fee,
        registration_fee: registration,
        daily_fee: daily,
        kit_fee: kit,
        discount_amount: discount,
        late_fee: late,
        total_amount: Number(total.toFixed(2))
    };
}

// ============================================
// GET: Monthly Fee List
// ============================================
export async function GET(request) {
    let connection;

    try {
        const { searchParams } = new URL(request.url);

        const id = searchParams.get("id");
        const academy_id = searchParams.get("academy_id");
        const branch_id = searchParams.get("branch_id");
        const program_id = searchParams.get("program_id");
        const admission_players_id =
            searchParams.get("admission_players_id");
        const user_program_id = searchParams.get("user_program_id");
        const payment_status = searchParams.get("payment_status");
        const month = searchParams.get("month");
        const search = searchParams.get("search");

        connection = await pool.getConnection();

        let sql = `
SELECT
f.id,
    f.academy_id,
    f.branch_id,
    f.user_program_id,
    f.admission_players_id,
    f.program_id,

    f.fee_month,
    DATE_FORMAT(f.fee_month, '%M %Y') AS fee_month_name,

        f.fee_amount,
        f.registration_fee,
        f.daily_fee,
        f.kit_fee,
        f.discount_amount,
        f.late_fee,
        f.total_amount,
        f.paid_amount,
        f.due_amount,
        f.payment_status,
        f.due_date,
        f.remarks,
        f.created_at,
        f.updated_at,

        ap.admission_no,
        CONCAT(
            ap.first_name,
            ' ',
            COALESCE(ap.last_name, '')
        ) AS player_name,

            p.program_name,
            up.appointment_no,
            up.start_date,
            up.end_date

            FROM cst_player_program_fees f

            INNER JOIN cst_user_programs up
                ON up.id = f.user_program_id

            INNER JOIN cst_admission_players ap
                ON ap.id = f.admission_players_id

            INNER JOIN cst_programs p
                ON p.id = f.program_id

            WHERE up.is_deleted = 0
              AND ap.is_deleted = 0
              AND p.is_deleted = 0
    `;

        const values = [];

        if (id) {
            sql += ` AND f.id = ? `;
            values.push(id);
        }

        if (academy_id) {
            sql += ` AND f.academy_id = ? `;
            values.push(academy_id);
        }

        if (branch_id) {
            sql += ` AND f.branch_id = ? `;
            values.push(branch_id);
        }

        if (program_id) {
            sql += ` AND f.program_id = ? `;
            values.push(program_id);
        }

        if (admission_players_id) {
            sql += ` AND f.admission_players_id = ? `;
            values.push(admission_players_id);
        }

        if (user_program_id) {
            sql += ` AND f.user_program_id = ? `;
            values.push(user_program_id);
        }

        // Example: month=2026-10
        if (month) {
            if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
                return NextResponse.json(
                    {
                        success: false,
                        message: "Invalid month format. Use YYYY-MM."
                    },
                    { status: 400 }
                );
            }

            const [year, monthNumber] = month.split("-").map(Number);

            const nextMonth = new Date(
                Date.UTC(year, monthNumber, 1)
            );

            const nextMonthDate =
                `${nextMonth.getUTCFullYear()}-` +
                `${String(nextMonth.getUTCMonth() + 1).padStart(2, "0")}-01`;

            sql += `
                AND f.fee_month >= ?
    AND f.fee_month < ?
        `;

            values.push(`${month}-01`, nextMonthDate);
        }

        const allowedStatuses = [
            "Pending",
            "Partial",
            "Paid",
            "Cancelled"
        ];

        if (payment_status) {
            if (!allowedStatuses.includes(payment_status)) {
                return NextResponse.json(
                    {
                        success: false,
                        message: "Invalid payment_status."
                    },
                    { status: 400 }
                );
            }

            sql += ` AND f.payment_status = ? `;
            values.push(payment_status);
        }

        if (search) {
            sql += `
                AND(
            ap.admission_no LIKE ?
            OR ap.first_name LIKE ?
            OR ap.last_name LIKE ?
            OR p.program_name LIKE ?
                )
    `;

            const searchValue = `%${search.trim()}%`;

            values.push(
                searchValue,
                searchValue,
                searchValue,
                searchValue
            );
        }

        sql += ` ORDER BY f.fee_month DESC, f.id DESC`;

        const [rows] = await connection.query(sql, values);

        return NextResponse.json({
            success: true,
            message: "Monthly fees fetched successfully.",
            total: rows.length,
            data: rows
        });

    } catch (error) {
        console.error("GET Monthly Fees Error:", error);

        return NextResponse.json(
            {
                success: false,
                message: "Failed to fetch monthly fees.",
                error: error.message
            },
            { status: 500 }
        );

    } finally {
        if (connection) connection.release();
    }
}


// ============================================
// POST: Generate Monthly Fee
// ============================================
export async function POST(request) {
    let connection;

    try {
        const body = await request.json();

        const {
            user_program_id,
            fee_month,
            fee_amount,
            registration_fee = 0,
            daily_fee = 0,
            kit_fee = 0,
            discount_amount = 0,
            late_fee = 0,
            due_date = null,
            remarks = null
        } = body;

        if (!user_program_id || !fee_month || fee_amount === undefined) {
            return NextResponse.json(
                {
                    success: false,
                    message: "user_program_id, fee_month and fee_amount are required."
                },
                { status: 400 }
            );
        }

        if (!isValidDate(fee_month) || fee_month.slice(-2) !== "01") {
            return NextResponse.json(
                {
                    success: false,
                    message: "fee_month must be the first day of a month, e.g. 2026-10-01."
                },
                { status: 400 }
            );
        }

        if (due_date !== null && !isValidDate(due_date)) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Invalid due_date. Use YYYY-MM-DD."
                },
                { status: 400 }
            );
        }

        const amounts = {
            fee_amount,
            registration_fee,
            daily_fee,
            kit_fee,
            discount_amount,
            late_fee
        };

        for (const [key, value] of Object.entries(amounts)) {
            if (!isValidAmount(value)) {
                return NextResponse.json(
                    {
                        success: false,
                        message: `${key} must be a valid non - negative amount.`
                    },
                    { status: 400 }
                );
            }
        }

        const calculated = calculateFeeAmounts(amounts);

        if (!calculated) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Discount cannot exceed the fee subtotal."
                },
                { status: 400 }
            );
        }

        connection = await pool.getConnection();

        await connection.beginTransaction();

        // Fetch enrollment details from database.
        const [enrollments] = await connection.query(
            `
SELECT
up.id AS user_program_id,
    up.branch_id,
    up.admission_players_id,
    up.program_id,
    up.start_date,
    up.end_date,
    p.academy_id

            FROM cst_user_programs up

            INNER JOIN cst_programs p
                ON p.id = up.program_id

            INNER JOIN cst_admission_players ap
                ON ap.id = up.admission_players_id

            WHERE up.id = ?
    AND up.status = 1
              AND up.is_deleted = 0
              AND p.status = 1
              AND p.is_deleted = 0
              AND ap.status = 1
              AND ap.is_deleted = 0

            FOR UPDATE
            `,
            [user_program_id]
        );

        if (enrollments.length === 0) {
            await connection.rollback();

            return NextResponse.json(
                {
                    success: false,
                    message: "Active player enrollment not found."
                },
                { status: 404 }
            );
        }

        const enrollment = enrollments[0];

        // Validate the billing month against the enrollment period.
        const monthStart = fee_month;
        const monthEnd = new Date(
            `${fee_month} T00:00:00.000Z`
        );

        monthEnd.setUTCMonth(monthEnd.getUTCMonth() + 1);

        const nextMonthStart = monthEnd.toISOString().slice(0, 10);

        if (
            enrollment.start_date &&
            nextMonthStart <= enrollment.start_date
        ) {
            await connection.rollback();

            return NextResponse.json(
                {
                    success: false,
                    message: "Fee month is before the enrollment period."
                },
                { status: 400 }
            );
        }

        if (
            enrollment.end_date &&
            monthStart > enrollment.end_date
        ) {
            await connection.rollback();

            return NextResponse.json(
                {
                    success: false,
                    message: "Fee month is after the enrollment period."
                },
                { status: 400 }
            );
        }

        // Check for duplicate invoice.
        const [existing] = await connection.query(
            `
            SELECT id
            FROM cst_player_program_fees
            WHERE user_program_id = ?
    AND fee_month = ?
        LIMIT 1
            `,
            [user_program_id, fee_month]
        );

        if (existing.length > 0) {
            await connection.rollback();

            return NextResponse.json(
                {
                    success: false,
                    message: "Fee invoice already exists for this enrollment and month.",
                    fee_id: existing[0].id
                },
                { status: 409 }
            );
        }

        const dueAmount = calculated.total_amount;

        const [result] = await connection.query(
            `
            INSERT INTO cst_player_program_fees(
                academy_id,
                branch_id,
                user_program_id,
                admission_players_id,
                program_id,
                fee_month,
                fee_amount,
                registration_fee,
                daily_fee,
                kit_fee,
                discount_amount,
                late_fee,
                total_amount,
                paid_amount,
                due_amount,
                payment_status,
                due_date,
                remarks
            )
VALUES(
                ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
                ?, ?, ?, 0.00, ?, 'Pending', ?, ?
)
            `,
            [
                enrollment.academy_id,
                enrollment.branch_id,
                enrollment.user_program_id,
                enrollment.admission_players_id,
                enrollment.program_id,
                fee_month,
                calculated.fee_amount,
                calculated.registration_fee,
                calculated.daily_fee,
                calculated.kit_fee,
                calculated.discount_amount,
                calculated.late_fee,
                calculated.total_amount,
                dueAmount,
                due_date,
                remarks
            ]
        );

        await connection.commit();

        return NextResponse.json(
            {
                success: true,
                message: "Monthly fee generated successfully.",
                data: {
                    id: result.insertId,
                    academy_id: enrollment.academy_id,
                    branch_id: enrollment.branch_id,
                    user_program_id: enrollment.user_program_id,
                    admission_players_id: enrollment.admission_players_id,
                    program_id: enrollment.program_id,
                    fee_month,
                    ...calculated,
                    paid_amount: 0,
                    due_amount: dueAmount,
                    payment_status: "Pending",
                    due_date,
                    remarks
                }
            },
            { status: 201 }
        );

    } catch (error) {
        if (connection) {
            await connection.rollback();
        }

        console.error("POST Monthly Fees Error:", error);

        if (error.code === "ER_DUP_ENTRY") {
            return NextResponse.json(
                {
                    success: false,
                    message: "Fee invoice already exists for this enrollment and month."
                },
                { status: 409 }
            );
        }

        return NextResponse.json(
            {
                success: false,
                message: "Failed to generate monthly fee."
            },
            { status: 500 }
        );

    } finally {
        if (connection) connection.release();
    }
}


