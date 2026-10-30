import { NextResponse } from "next/server";
import pool from "@/app/components/lib/db.js";
import { getAuthUser } from "@/app/components/lib/rbac.js";

const MONTHS = [
    { key: "01", name: "Jan", full: "January" },
    { key: "02", name: "Feb", full: "February" },
    { key: "03", name: "Mar", full: "March" },
    { key: "04", name: "Apr", full: "April" },
    { key: "05", name: "May", full: "May" },
    { key: "06", name: "Jun", full: "June" },
    { key: "07", name: "Jul", full: "July" },
    { key: "08", name: "Aug", full: "August" },
    { key: "09", name: "Sep", full: "September" },
    { key: "10", name: "Oct", full: "October" },
    { key: "11", name: "Nov", full: "November" },
    { key: "12", name: "Dec", full: "December" },
];

export async function GET(request) {
    let connection;

    try {
        const { searchParams } = new URL(request.url);

        const currentYear = new Date().getFullYear();
        const yearParam = Number(searchParams.get("year")) || currentYear;
        const year = yearParam >= 2000 && yearParam <= 2100 ? yearParam : currentYear;

        const academy_id = searchParams.get("academy_id");
        const branch_id = searchParams.get("branch_id");
        const program_id = searchParams.get("program_id");
        const status_filter = searchParams.get("payment_status");
        const search = searchParams.get("search");

        connection = await pool.getConnection();

        // 1. Fetch active players and their program enrollments
        let playerSql = `
            SELECT
                up.id AS user_program_id,
                up.user_id,
                up.appointment_no,
                up.program_id,
                up.branch_id,
                up.admission_players_id,
                up.start_date,
                up.end_date,
                up.created_at,
                up.status AS enrollment_status,
                ap.admission_no,
                CONCAT_WS(' ', ap.first_name, ap.last_name) AS player_name,
                ap.phone AS player_phone,
                p.program_name,
                p.program_fee,
                p.registration_fee,
                p.daily_fee,
                p.kit_fee,
                p.academy_id,
                b.branch_name,
                a.academy_name
            FROM cst_user_programs up
            INNER JOIN cst_admission_players ap ON ap.id = up.admission_players_id
            INNER JOIN cst_programs p ON p.id = up.program_id
            INNER JOIN cst_branch b ON b.id = up.branch_id
            LEFT JOIN cst_academy a ON a.id = p.academy_id
            WHERE up.is_deleted = 0
              AND ap.is_deleted = 0
              AND p.is_deleted = 0
        `;

        const playerValues = [];

        const authUser = await getAuthUser(request);
        if (authUser) {
            if (authUser.isCoach) {
                playerSql += ` AND ap.id IN (
                    SELECT up2.admission_players_id
                    FROM cst_user_programs up2
                    JOIN cst_batch_players bp ON bp.user_program_id = up2.id
                    JOIN cst_batch_coaches bc ON bc.batch_id = bp.batch_id
                    WHERE bc.coach_user_id = ? AND bc.status = 1 AND bc.is_deleted = 0
                )`;
                playerValues.push(authUser.id);
            } else if (authUser.isBranchAdmin && authUser.branch_id) {
                playerSql += ` AND up.branch_id = ? AND p.academy_id = ? `;
                playerValues.push(authUser.branch_id, authUser.academy_id);
            } else if (authUser.isAcademyAdmin && authUser.academy_id) {
                playerSql += ` AND p.academy_id = ? `;
                playerValues.push(authUser.academy_id);
                if (branch_id) {
                    playerSql += ` AND up.branch_id = ? `;
                    playerValues.push(Number(branch_id));
                }
            } else if (authUser.isAccountant && authUser.academy_id) {
                playerSql += ` AND p.academy_id = ? `;
                playerValues.push(authUser.academy_id);
                if (authUser.branch_id) {
                    playerSql += ` AND up.branch_id = ? `;
                    playerValues.push(authUser.branch_id);
                } else if (branch_id) {
                    playerSql += ` AND up.branch_id = ? `;
                    playerValues.push(Number(branch_id));
                }
            } else if (!authUser.isSuperAdmin && authUser.academy_id) {
                playerSql += ` AND p.academy_id = ? `;
                playerValues.push(authUser.academy_id);
            } else {
                if (academy_id) {
                    playerSql += ` AND p.academy_id = ? `;
                    playerValues.push(Number(academy_id));
                }
                if (branch_id) {
                    playerSql += ` AND up.branch_id = ? `;
                    playerValues.push(Number(branch_id));
                }
            }
        } else {
            if (academy_id) {
                playerSql += ` AND p.academy_id = ? `;
                playerValues.push(Number(academy_id));
            }
            if (branch_id) {
                playerSql += ` AND up.branch_id = ? `;
                playerValues.push(Number(branch_id));
            }
        }

        if (program_id) {
            playerSql += ` AND up.program_id = ? `;
            playerValues.push(Number(program_id));
        }

        if (search && search.trim()) {
            const keyword = `%${search.trim()}%`;
            playerSql += `
                AND (
                    ap.admission_no LIKE ?
                    OR ap.first_name LIKE ?
                    OR ap.last_name LIKE ?
                    OR p.program_name LIKE ?
                    OR b.branch_name LIKE ?
                )
            `;
            playerValues.push(keyword, keyword, keyword, keyword, keyword);
        }

        playerSql += ` ORDER BY ap.first_name ASC, up.id DESC `;

        const [players] = await connection.query(playerSql, playerValues);

        if (players.length === 0) {
            return NextResponse.json({
                success: true,
                year,
                months: MONTHS,
                totalPlayers: 0,
                stats: {
                    totalYearInvoiced: 0,
                    totalYearPaid: 0,
                    totalYearDue: 0,
                    paidCount: 0,
                    partialCount: 0,
                    pendingCount: 0,
                },
                monthlyStats: MONTHS.map((m) => ({
                    ...m,
                    invoiced: 0,
                    paid: 0,
                    due: 0,
                    paidCount: 0,
                    partialCount: 0,
                    pendingCount: 0,
                })),
                data: [],
            });
        }

        // 2. Fetch all fee records for this year
        const startDate = `${year}-01-01`;
        const endDate = `${year + 1}-01-01`;

        const [fees] = await connection.query(
            `
            SELECT
                f.id AS fee_id,
                f.user_program_id,
                f.admission_players_id,
                f.program_id,
                f.fee_month,
                DATE_FORMAT(f.fee_month, '%m') AS month_number,
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
                f.remarks
            FROM cst_player_program_fees f
            WHERE f.fee_month >= ? AND f.fee_month < ?
            ORDER BY f.fee_month ASC, f.id ASC
            `,
            [startDate, endDate]
        );

        // Group fees by user_program_id -> month_number (01 to 12)
        const feesByEnrollment = new Map();
        for (const fee of fees) {
            const upId = fee.user_program_id;
            if (!feesByEnrollment.has(upId)) {
                feesByEnrollment.set(upId, new Map());
            }
            feesByEnrollment.get(upId).set(fee.month_number, fee);
        }

        // Helper to format date value into YYYY-MM
        const toYearMonth = (val) => {
            if (!val) return null;
            let s = "";
            if (typeof val === "string") {
                s = val;
            } else if (val instanceof Date) {
                s = val.toISOString();
            } else {
                s = String(val);
            }
            s = s.trim().slice(0, 7);
            if (s.startsWith("0000") || s.length < 7) return null;
            return s;
        };

        // 3. Build Matrix Rows
        const monthlyStatsMap = new Map();
        MONTHS.forEach((m) => {
            monthlyStatsMap.set(m.key, {
                ...m,
                invoiced: 0,
                paid: 0,
                due: 0,
                paidCount: 0,
                partialCount: 0,
                pendingCount: 0,
            });
        });

        let overallInvoiced = 0;
        let overallPaid = 0;
        let overallDue = 0;
        let overallPaidCount = 0;
        let overallPartialCount = 0;
        let overallPendingCount = 0;

        let matrixRows = players
            .map((player) => {
                const enrollmentFees = feesByEnrollment.get(player.user_program_id) || new Map();
                const monthsData = {};

                const startMonth = toYearMonth(player.start_date) || toYearMonth(player.created_at);
                const endMonth = toYearMonth(player.end_date);
                const defaultMonthlyFee = Number(player.program_fee) || 0;

                let rowInvoiced = 0;
                let rowPaid = 0;
                let rowDue = 0;

                let rowPaidCount = 0;
                let rowPartialCount = 0;
                let rowPendingCount = 0;

                let hasAnyActivityInYear = false;

                MONTHS.forEach((m) => {
                    const currentMonth = `${year}-${m.key}`;
                    const fee = enrollmentFees.get(m.key);

                    // Check enrollment period:
                    // 1. If startMonth exists, month must be on or after startMonth
                    // 2. If endMonth exists, month must be on or before endMonth.
                    // 3. If endMonth does NOT exist, program continues indefinitely.
                    const isBeforeStart = Boolean(startMonth && currentMonth < startMonth);
                    const isAfterEnd = Boolean(endMonth && currentMonth > endMonth);
                    const isEnrolled = !isBeforeStart && !isAfterEnd;

                    if (fee) {
                        hasAnyActivityInYear = true;
                        const total = Number(fee.total_amount) || 0;
                        const paid = Number(fee.paid_amount) || 0;
                        const due = Number(fee.due_amount) || 0;
                        const status = fee.payment_status || "Pending";

                        monthsData[m.key] = {
                            fee_id: fee.fee_id,
                            fee_month: fee.fee_month,
                            month_key: m.key,
                            month_name: m.name,
                            total_amount: total,
                            paid_amount: paid,
                            due_amount: due,
                            payment_status: status,
                            due_date: fee.due_date,
                            remarks: fee.remarks,
                            is_virtual: false,
                        };

                        rowInvoiced += total;
                        rowPaid += paid;
                        rowDue += due;

                        if (status === "Paid") {
                            rowPaidCount++;
                            overallPaidCount++;
                        } else if (status === "Partial") {
                            rowPartialCount++;
                            overallPartialCount++;
                        } else {
                            rowPendingCount++;
                            overallPendingCount++;
                        }

                        overallInvoiced += total;
                        overallPaid += paid;
                        overallDue += due;

                        // Update monthly aggregation
                        const mStats = monthlyStatsMap.get(m.key);
                        if (mStats) {
                            mStats.invoiced += total;
                            mStats.paid += paid;
                            mStats.due += due;
                            if (status === "Paid") mStats.paidCount++;
                            else if (status === "Partial") mStats.partialCount++;
                            else mStats.pendingCount++;
                        }
                    } else if (isEnrolled) {
                        // Enrolled month without a generated invoice yet -> Mark as Pending
                        hasAnyActivityInYear = true;
                        const total = defaultMonthlyFee;
                        const paid = 0;
                        const due = defaultMonthlyFee;
                        const status = "Pending";

                        monthsData[m.key] = {
                            fee_id: null,
                            fee_month: `${year}-${m.key}-01`,
                            month_key: m.key,
                            month_name: m.name,
                            total_amount: total,
                            paid_amount: paid,
                            due_amount: due,
                            payment_status: status,
                            due_date: null,
                            remarks: "Enrolled program fee pending",
                            is_virtual: true,
                        };

                        rowInvoiced += total;
                        rowPaid += paid;
                        rowDue += due;

                        rowPendingCount++;
                        overallPendingCount++;

                        overallInvoiced += total;
                        overallDue += due;

                        const mStats = monthlyStatsMap.get(m.key);
                        if (mStats) {
                            mStats.invoiced += total;
                            mStats.due += due;
                            mStats.pendingCount++;
                        }
                    } else {
                        // Outside enrollment duration and no fee record
                        monthsData[m.key] = null;
                    }
                });

                if (!hasAnyActivityInYear) {
                    return null;
                }

                return {
                    ...player,
                    rowStats: {
                        totalInvoiced: rowInvoiced,
                        totalPaid: rowPaid,
                        totalDue: rowDue,
                        paidCount: rowPaidCount,
                        partialCount: rowPartialCount,
                        pendingCount: rowPendingCount,
                    },
                    months: monthsData,
                };
            })
            .filter(Boolean);

        // Filter by payment_status if requested (e.g. show players who have 'Pending' or 'Partial' in any month)
        if (status_filter) {
            matrixRows = matrixRows.filter((row) => {
                return Object.values(row.months).some(
                    (m) => m && m.payment_status === status_filter
                );
            });
        }

        return NextResponse.json({
            success: true,
            year,
            months: MONTHS,
            totalPlayers: matrixRows.length,
            stats: {
                totalYearInvoiced: Number(overallInvoiced.toFixed(2)),
                totalYearPaid: Number(overallPaid.toFixed(2)),
                totalYearDue: Number(overallDue.toFixed(2)),
                paidCount: overallPaidCount,
                partialCount: overallPartialCount,
                pendingCount: overallPendingCount,
            },
            monthlyStats: Array.from(monthlyStatsMap.values()),
            data: matrixRows,
        });
    } catch (error) {
        console.error("GET Player Fees Matrix Error:", error);
        return NextResponse.json(
            {
                success: false,
                message: "Failed to fetch yearly fees matrix.",
                error: error.message,
            },
            { status: 500 }
        );
    } finally {
        if (connection) {
            connection.release();
        }
    }
}
