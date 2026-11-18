import { NextResponse } from "next/server";
import pool from "@/app/components/lib/db";
import { getAuthenticatedUser } from "@/app/components/lib/tenant-isolation.js";

export async function GET(request) {
    const { user: authUser, errorResponse } = await getAuthenticatedUser(request);
    if (errorResponse) return errorResponse;

    let connection;

    try {
        connection = await pool.getConnection();
        const { searchParams } = new URL(request.url);

        const now = new Date();
        const month = parseInt(searchParams.get("month") || String(now.getMonth() + 1), 10);
        const year = parseInt(searchParams.get("year") || String(now.getFullYear()), 10);

        const academyIdParam = searchParams.get("academy_id");
        const branchIdParam = searchParams.get("branch_id");

        // Determine tenant scope
        let targetAcademyId = null;
        let targetBranchId = null;

        if (authUser.isSuperAdmin) {
            targetAcademyId = academyIdParam ? Number(academyIdParam) : null;
            targetBranchId = branchIdParam ? Number(branchIdParam) : null;
        } else if (authUser.isAcademyAdmin) {
            targetAcademyId = Number(authUser.academy_id);
            targetBranchId = branchIdParam ? Number(branchIdParam) : null;
        } else if (authUser.isBranchAdmin) {
            targetAcademyId = Number(authUser.academy_id);
            targetBranchId = Number(authUser.branch_id);
        } else {
            targetAcademyId = Number(authUser.academy_id || 0);
            targetBranchId = authUser.branch_id ? Number(authUser.branch_id) : null;
        }

        // Calculate Date Range for Month
        const padMonth = String(month).padStart(2, "0");
        const startDate = `${year}-${padMonth}-01`;
        const lastDay = new Date(year, month, 0).getDate();
        const endDate = `${year}-${padMonth}-${String(lastDay).padStart(2, "0")}`;
        const monthYearStr = `${year}-${padMonth}`;

        // 1. Fetch Academies & Branches for Super Admin & Academy Admin Filters
        let academiesList = [];
        let branchesList = [];

        if (authUser.isSuperAdmin) {
            const [aRows] = await connection.query("SELECT id, academy_name FROM cst_academy WHERE status = 1 ORDER BY academy_name");
            academiesList = aRows;

            let bSql = "SELECT id, academy_id, branch_name FROM cst_branch WHERE status = 1";
            const bParams = [];
            if (targetAcademyId) {
                bSql += " AND academy_id = ?";
                bParams.push(targetAcademyId);
            }
            bSql += " ORDER BY branch_name";
            const [bRows] = await connection.query(bSql, bParams);
            branchesList = bRows;
        } else if (authUser.isAcademyAdmin) {
            const [bRows] = await connection.query(
                "SELECT id, academy_id, branch_name FROM cst_branch WHERE academy_id = ? AND status = 1 ORDER BY branch_name",
                [targetAcademyId]
            );
            branchesList = bRows;
        }

        // =========================================================================
        // 1. PLAYER PROGRAM FEES: Expected (Demand) vs Received vs Due
        // =========================================================================
        let ppfWhere = " WHERE (DATE_FORMAT(ppf.fee_month, '%Y-%m') = ? OR (ppf.fee_month >= ? AND ppf.fee_month <= ?)) ";
        const ppfParams = [monthYearStr, startDate, endDate];

        if (targetAcademyId) {
            ppfWhere += " AND ppf.academy_id = ? ";
            ppfParams.push(targetAcademyId);
        }
        if (targetBranchId) {
            ppfWhere += " AND ppf.branch_id = ? ";
            ppfParams.push(targetBranchId);
        }

        // Program-wise summary (Expected vs Received vs Due)
        const [programSummaryRows] = await connection.query(
            `SELECT
                COALESCE(p.id, 0) AS program_id,
                COALESCE(p.program_name, 'General Academy Fee') AS program_name,
                p.program_code,
                COUNT(ppf.id) AS total_students,
                COALESCE(SUM(ppf.total_amount), 0) AS expected_demand,
                COALESCE(SUM(ppf.paid_amount), 0) AS received_amount,
                COALESCE(SUM(ppf.due_amount), 0) AS due_amount
             FROM cst_player_program_fees ppf
             LEFT JOIN cst_programs p ON p.id = ppf.program_id
             ${ppfWhere}
             GROUP BY p.id, p.program_name, p.program_code
             ORDER BY expected_demand DESC`,
            ppfParams
        );

        // Individual player fee records in this month
        const [playerFeeRecords] = await connection.query(
            `SELECT
                ppf.id,
                ppf.admission_players_id,
                ppf.total_amount,
                ppf.paid_amount,
                ppf.due_amount,
                ppf.payment_status,
                ppf.fee_month,
                ap.admission_no,
                CONCAT(COALESCE(ap.first_name, ''), ' ', COALESCE(ap.last_name, '')) AS player_name,
                ap.phone AS player_phone,
                p.program_name,
                b.branch_name
             FROM cst_player_program_fees ppf
             LEFT JOIN cst_admission_players ap ON ap.id = ppf.admission_players_id
             LEFT JOIN cst_programs p ON p.id = ppf.program_id
             LEFT JOIN cst_branch b ON b.id = ppf.branch_id
             ${ppfWhere}
             ORDER BY ppf.due_amount DESC, ppf.id DESC`,
            ppfParams
        );

        // Player payments made in this date range
        let ppWhere = " WHERE pp.payment_date >= ? AND pp.payment_date <= ? ";
        const ppParams = [startDate, endDate];
        if (targetAcademyId) {
            ppWhere += " AND ppf.academy_id = ? ";
            ppParams.push(targetAcademyId);
        }
        if (targetBranchId) {
            ppWhere += " AND ppf.branch_id = ? ";
            ppParams.push(targetBranchId);
        }

        const [playerPaymentsList] = await connection.query(
            `SELECT
                pp.id,
                pp.receipt_no,
                pp.paid_amount,
                pp.payment_mode,
                pp.transaction_no,
                pp.payment_date,
                pp.payment_status,
                pp.remarks,
                ap.id AS player_id,
                ap.admission_no,
                CONCAT(COALESCE(ap.first_name, ''), ' ', COALESCE(ap.last_name, '')) AS player_name,
                ap.phone AS player_phone,
                p.program_name,
                b.branch_name
             FROM cst_player_payments pp
             INNER JOIN cst_player_program_fees ppf ON ppf.id = pp.player_program_fee_id
             LEFT JOIN cst_admission_players ap ON ap.id = ppf.admission_players_id
             LEFT JOIN cst_programs p ON p.id = ppf.program_id
             LEFT JOIN cst_branch b ON b.id = ppf.branch_id
             ${ppWhere}
             ORDER BY pp.payment_date DESC, pp.id DESC`,
            ppParams
        );

        const playerFeesExpected = programSummaryRows.reduce((sum, p) => sum + Number(p.expected_demand || 0), 0);
        const playerFeesReceived = programSummaryRows.reduce((sum, p) => sum + Number(p.received_amount || 0), 0);
        const playerFeesDue = programSummaryRows.reduce((sum, p) => sum + Number(p.due_amount || 0), 0);
        const totalUniquePlayers = new Set(playerFeeRecords.map((p) => p.admission_players_id).filter(Boolean)).size;

        // =========================================================================
        // 2. MATCH FEES: Match-Wise Expected vs Received vs Due
        // =========================================================================
        let matchWhere = " WHERE m.match_date >= ? AND m.match_date <= ? ";
        const matchParams = [startDate, endDate];

        if (targetAcademyId) {
            matchWhere += " AND m.academy_id = ? ";
            matchParams.push(targetAcademyId);
        }
        if (targetBranchId) {
            matchWhere += " AND m.branch_id = ? ";
            matchParams.push(targetBranchId);
        }

        const [matchRows] = await connection.query(
            `SELECT 
                m.id AS match_id,
                m.match_no,
                m.match_type,
                m.match_date,
                m.match_time,
                m.status AS match_status,
                COALESCE(g.ground_name, 'Not Assigned') AS ground_name,
                COALESCE(ta.team_name, 'Team A') AS team_a_name,
                COALESCE(tb.team_name, 'Team B') AS team_b_name,
                m.match_fee,
                COALESCE(fs_agg.total_fee_demand, m.match_fee, 0) AS expected_fee,
                COALESCE(fs_agg.total_paid, 0) AS received_fee,
                GREATEST(0, COALESCE(fs_agg.total_fee_demand, m.match_fee, 0) - COALESCE(fs_agg.total_paid, 0)) AS due_fee,
                CASE 
                    WHEN COALESCE(fs_agg.total_paid, 0) >= COALESCE(fs_agg.total_fee_demand, m.match_fee, 0) AND COALESCE(fs_agg.total_fee_demand, m.match_fee, 0) > 0 THEN 'Paid'
                    WHEN COALESCE(fs_agg.total_paid, 0) > 0 THEN 'Partial'
                    WHEN COALESCE(fs_agg.total_fee_demand, m.match_fee, 0) > 0 THEN 'Pending'
                    ELSE 'Free / N/A'
                END AS fee_payment_status,
                COALESCE(fs_agg.player_count, 0) AS player_fee_records,
                b.branch_name
            FROM cst_matches m
            LEFT JOIN cst_ground g ON g.id = m.ground_id
            LEFT JOIN cst_teams ta ON ta.id = m.team_a_id
            LEFT JOIN cst_teams tb ON tb.id = m.team_b_id
            LEFT JOIN cst_branch b ON b.id = m.branch_id
            LEFT JOIN (
                SELECT 
                    match_id,
                    COUNT(*) AS player_count,
                    SUM(fee_amount) AS total_fee_demand,
                    SUM(paid_amount) AS total_paid,
                    SUM(balance_amount) AS total_balance
                FROM cst_fee_status
                WHERE match_id IS NOT NULL
                GROUP BY match_id
            ) fs_agg ON fs_agg.match_id = m.id
            ${matchWhere}
            ORDER BY m.match_date DESC, m.id DESC`,
            matchParams
        );

        const matchFeesExpected = matchRows.reduce((sum, m) => sum + Number(m.expected_fee || 0), 0);
        const matchFeesReceived = matchRows.reduce((sum, m) => sum + Number(m.received_fee || 0), 0);
        const matchFeesDue = matchRows.reduce((sum, m) => sum + Number(m.due_fee || 0), 0);

        // =========================================================================
        // 3. GROUND BOOKING RENTALS: Expected vs Received vs Due
        // =========================================================================
        let gbWhere = " WHERE gb.booking_date >= ? AND gb.booking_date <= ? AND g.is_deleted = 0 ";
        const gbParams = [startDate, endDate];

        if (targetAcademyId) {
            gbWhere += " AND g.academy_id = ? ";
            gbParams.push(targetAcademyId);
        }
        if (targetBranchId) {
            gbWhere += " AND g.branch_id = ? ";
            gbParams.push(targetBranchId);
        }

        // Ground-wise summary
        const [groundSummaryRows] = await connection.query(
            `SELECT
                g.id AS ground_id,
                g.ground_name,
                g.ground_code,
                COUNT(gb.id) AS bookings_count,
                COALESCE(SUM(gb.total_amount), 0) AS expected_rental,
                COALESCE(SUM(gb.paid_amount), 0) AS received_rental,
                COALESCE(SUM(gb.balance_amount), 0) AS due_rental
             FROM cst_ground_bookings gb
             INNER JOIN cst_ground g ON g.id = gb.ground_id
             ${gbWhere}
             GROUP BY g.id, g.ground_name, g.ground_code
             ORDER BY expected_rental DESC`,
            gbParams
        );

        // Detailed individual bookings list
        const [groundBookingsList] = await connection.query(
            `SELECT
                gb.id AS booking_id,
                gb.booking_no,
                gb.customer_name,
                gb.customer_phone,
                gb.booking_date,
                gb.purpose,
                gb.total_amount,
                gb.paid_amount,
                gb.balance_amount,
                gb.payment_status,
                gb.booking_status,
                g.ground_name,
                b.branch_name
             FROM cst_ground_bookings gb
             INNER JOIN cst_ground g ON g.id = gb.ground_id
             LEFT JOIN cst_branch b ON b.id = g.branch_id
             ${gbWhere}
             ORDER BY gb.booking_date DESC, gb.id DESC`,
            gbParams
        );

        // Ground booking payments list
        const [groundPaymentDetails] = await connection.query(
            `SELECT
                gp.id,
                gp.amount,
                gp.payment_mode,
                gp.transaction_no,
                gp.payment_date,
                gp.remarks,
                gb.booking_no,
                gb.customer_name,
                g.ground_name,
                b.branch_name
             FROM cst_ground_payments gp
             INNER JOIN cst_ground_bookings gb ON gb.id = gp.booking_id
             INNER JOIN cst_ground g ON g.id = gb.ground_id
             LEFT JOIN cst_branch b ON b.id = g.branch_id
             WHERE gp.payment_date >= ? AND gp.payment_date <= ? AND g.is_deleted = 0
             ${targetAcademyId ? " AND g.academy_id = " + Number(targetAcademyId) : ""}
             ${targetBranchId ? " AND g.branch_id = " + Number(targetBranchId) : ""}
             ORDER BY gp.payment_date DESC, gp.id DESC`,
            [startDate, endDate]
        );

        const groundRentalsExpected = groundSummaryRows.reduce((sum, g) => sum + Number(g.expected_rental || 0), 0);
        const groundRentalsReceived = groundSummaryRows.reduce((sum, g) => sum + Number(g.received_rental || 0), 0);
        const groundRentalsDue = groundSummaryRows.reduce((sum, g) => sum + Number(g.due_rental || 0), 0);

        // =========================================================================
        // 4. STAFF & COACH SALARIES: Payable vs Paid vs Due
        // =========================================================================
        let sspWhere = " WHERE ssp.salary_month = ? AND ssp.salary_year = ? ";
        const sspParams = [month, year];

        if (targetAcademyId) {
            sspWhere += " AND ssp.academy_id = ? ";
            sspParams.push(targetAcademyId);
        }
        if (targetBranchId) {
            sspWhere += " AND ssp.branch_id = ? ";
            sspParams.push(targetBranchId);
        }

        const [staffSalaryList] = await connection.query(
            `SELECT
                ssp.id,
                ssp.staff_id,
                ssp.salary_month,
                ssp.salary_year,
                ssp.basic_salary,
                ssp.gross_salary,
                ssp.net_salary,
                ssp.paid_amount,
                ssp.due_amount,
                ssp.payment_status,
                ssp.payment_date,
                ssp.remarks,
                s.appointment_no,
                CONCAT(COALESCE(s.first_name, ''), ' ', COALESCE(s.last_name, '')) AS staff_name,
                s.speciality,
                r.role_name AS designation,
                b.branch_name
             FROM cst_staff_salary_payments ssp
             INNER JOIN cst_staff s ON s.id = ssp.staff_id
             LEFT JOIN cst_roles r ON r.id = s.role_id
             LEFT JOIN cst_branch b ON b.id = ssp.branch_id
             ${sspWhere}
             ORDER BY ssp.id DESC`,
            sspParams
        );

        const staffSalariesPayable = staffSalaryList.reduce((sum, s) => sum + Number(s.net_salary || 0), 0);
        const staffSalariesPaid = staffSalaryList.reduce((sum, s) => sum + Number(s.paid_amount || 0), 0);
        const staffSalariesDue = staffSalaryList.reduce((sum, s) => sum + (Number(s.due_amount) > 0 ? Number(s.due_amount) : 0), 0);
        const totalPaidStaffCount = staffSalaryList.filter((s) => Number(s.paid_amount) > 0).length;

        // =========================================================================
        // 5. UMPIRE FEES: Payable vs Paid vs Due
        // =========================================================================
        let umpireGbWhere = " WHERE gb.booking_date >= ? AND gb.booking_date <= ? AND gb.umpire_id IS NOT NULL ";
        const umpireGbParams = [startDate, endDate];
        if (targetAcademyId) {
            umpireGbWhere += " AND g.academy_id = ? ";
            umpireGbParams.push(targetAcademyId);
        }
        if (targetBranchId) {
            umpireGbWhere += " AND g.branch_id = ? ";
            umpireGbParams.push(targetBranchId);
        }

        let umpireMatchWhere = " WHERE m.match_date >= ? AND m.match_date <= ? ";
        const umpireMatchParams = [startDate, endDate];
        if (targetAcademyId) {
            umpireMatchWhere += " AND m.academy_id = ? ";
            umpireMatchParams.push(targetAcademyId);
        }
        if (targetBranchId) {
            umpireMatchWhere += " AND m.branch_id = ? ";
            umpireMatchParams.push(targetBranchId);
        }

        const [umpireDutiesList] = await connection.query(
            `SELECT 
                u.id AS umpire_id,
                u.umpire_name,
                u.mobile,
                'Ground Booking' AS duty_type,
                gb.id AS booking_id,
                NULL AS match_id,
                gb.booking_no AS reference_no,
                gb.booking_date AS event_date,
                g.ground_name,
                COALESCE(uf.fee_amount, 0) AS fee_payable,
                COALESCE(up_agg.paid_amount, 0) AS fee_paid,
                GREATEST(0, COALESCE(uf.fee_amount, 0) - COALESCE(up_agg.paid_amount, 0)) AS fee_due,
                CASE 
                    WHEN COALESCE(up_agg.paid_amount, 0) >= COALESCE(uf.fee_amount, 0) AND COALESCE(uf.fee_amount, 0) > 0 THEN 'Paid'
                    WHEN COALESCE(up_agg.paid_amount, 0) > 0 THEN 'Partial'
                    ELSE 'Pending'
                END AS payment_status,
                b.branch_name
            FROM cst_ground_bookings gb
            INNER JOIN cst_umpires u ON u.id = gb.umpire_id
            INNER JOIN cst_ground g ON g.id = gb.ground_id
            LEFT JOIN cst_branch b ON b.id = g.branch_id
            LEFT JOIN cst_umpire_fees uf ON uf.id = gb.umpire_fee_id
            LEFT JOIN (
                SELECT booking_id, umpire_id, SUM(amount) AS paid_amount
                FROM cst_umpire_payments
                GROUP BY booking_id, umpire_id
            ) up_agg ON up_agg.booking_id = gb.id AND up_agg.umpire_id = u.id
            ${umpireGbWhere}

            UNION ALL

            SELECT 
                u.id AS umpire_id,
                u.umpire_name,
                u.mobile,
                'Match' AS duty_type,
                NULL AS booking_id,
                m.id AS match_id,
                m.match_no AS reference_no,
                m.match_date AS event_date,
                COALESCE(g.ground_name, 'Not Assigned') AS ground_name,
                COALESCE(mu.fee_amount, 0) AS fee_payable,
                COALESCE(up_agg2.paid_amount, 0) AS fee_paid,
                GREATEST(0, COALESCE(mu.fee_amount, 0) - COALESCE(up_agg2.paid_amount, 0)) AS fee_due,
                CASE 
                    WHEN COALESCE(up_agg2.paid_amount, 0) >= COALESCE(mu.fee_amount, 0) AND COALESCE(mu.fee_amount, 0) > 0 THEN 'Paid'
                    WHEN COALESCE(up_agg2.paid_amount, 0) > 0 THEN 'Partial'
                    ELSE 'Pending'
                END AS payment_status,
                b.branch_name
            FROM cst_match_umpires mu
            INNER JOIN cst_umpires u ON u.id = mu.umpire_id
            INNER JOIN cst_matches m ON m.id = mu.match_id
            LEFT JOIN cst_ground g ON g.id = m.ground_id
            LEFT JOIN cst_branch b ON b.id = m.branch_id
            LEFT JOIN (
                SELECT match_id, umpire_id, SUM(amount) AS paid_amount
                FROM cst_umpire_payments
                GROUP BY match_id, umpire_id
            ) up_agg2 ON up_agg2.match_id = mu.match_id AND up_agg2.umpire_id = u.id
            ${umpireMatchWhere}
            ORDER BY event_date DESC`,
            [...umpireGbParams, ...umpireMatchParams]
        );

        // Actual Umpire Payment Receipts
        let upWhere = " WHERE up.payment_date >= ? AND up.payment_date <= ? ";
        const upParams = [startDate, endDate];
        if (targetAcademyId) {
            upWhere += " AND up.academy_id = ? ";
            upParams.push(targetAcademyId);
        }
        if (targetBranchId) {
            upWhere += " AND up.branch_id = ? ";
            upParams.push(targetBranchId);
        }

        const [umpirePaymentDetails] = await connection.query(
            `SELECT
                up.id,
                up.umpire_id,
                up.amount,
                up.payment_mode,
                up.transaction_no,
                up.payment_date,
                up.remarks,
                u.umpire_name,
                u.mobile AS umpire_mobile,
                m.match_no,
                gb.booking_no,
                b.branch_name
             FROM cst_umpire_payments up
             INNER JOIN cst_umpires u ON u.id = up.umpire_id
             LEFT JOIN cst_matches m ON m.id = up.match_id
             LEFT JOIN cst_ground_bookings gb ON gb.id = up.booking_id
             LEFT JOIN cst_branch b ON b.id = up.branch_id
             ${upWhere}
             ORDER BY up.payment_date DESC, up.id DESC`,
            upParams
        );

        const umpireFeesPayable = umpireDutiesList.reduce((sum, u) => sum + Number(u.fee_payable || 0), 0);
        const umpireFeesPaidFromPayments = umpirePaymentDetails.reduce((sum, u) => sum + Number(u.amount || 0), 0);
        const umpireFeesPaid = Math.max(
            umpireFeesPaidFromPayments,
            umpireDutiesList.reduce((sum, u) => sum + Number(u.fee_paid || 0), 0)
        );
        const umpireFeesDue = Math.max(0, umpireFeesPayable - umpireFeesPaid);

        // =========================================================================
        // 6. TOTALS & FINANCIAL SUMMARY (Demand vs Actual vs Due)
        // =========================================================================
        // Total Inflow (Revenue)
        const totalInflowExpected = playerFeesExpected + matchFeesExpected + groundRentalsExpected;
        const totalInflowReceived = playerFeesReceived + matchFeesReceived + groundRentalsReceived;
        const totalInflowDue = playerFeesDue + matchFeesDue + groundRentalsDue;

        // Total Outflow (Expenses)
        const totalOutflowPayable = staffSalariesPayable + umpireFeesPayable;
        const totalOutflowPaid = staffSalariesPaid + umpireFeesPaid;
        const totalOutflowDue = staffSalariesDue + umpireFeesDue;

        // Net Operating Cash Flow (Actual Received - Actual Paid)
        const netCashFlow = totalInflowReceived - totalOutflowPaid;
        const isCashPositive = netCashFlow >= 0;

        // Projected Accrued Profit (Total Demand - Total Expenses Payable)
        const netAccruedProfit = totalInflowExpected - totalOutflowPayable;
        const isAccruedProfitable = netAccruedProfit >= 0;

        return NextResponse.json({
            success: true,
            data: {
                period: {
                    month,
                    year,
                    startDate,
                    endDate,
                },
                scope: {
                    userRole: authUser.role_name || (authUser.isSuperAdmin ? "Super Admin" : authUser.isAcademyAdmin ? "Academy Admin" : "Branch Admin"),
                    isSuperAdmin: Boolean(authUser.isSuperAdmin),
                    isAcademyAdmin: Boolean(authUser.isAcademyAdmin),
                    isBranchAdmin: Boolean(authUser.isBranchAdmin),
                    selectedAcademyId: targetAcademyId,
                    selectedBranchId: targetBranchId,
                },
                filters: {
                    academies: academiesList,
                    branches: branchesList,
                },
                totals: {
                    // Overall Inflow
                    totalInflowExpected,
                    totalInflowReceived,
                    totalInflowDue,
                    // Overall Outflow
                    totalOutflowPayable,
                    totalOutflowPaid,
                    totalOutflowDue,
                    // Net metrics
                    netCashFlow,
                    isCashPositive,
                    netAccruedProfit,
                    isAccruedProfitable,
                    // Stream summary
                    playerFeesExpected,
                    playerFeesReceived,
                    playerFeesDue,
                    matchFeesExpected,
                    matchFeesReceived,
                    matchFeesDue,
                    groundRentalsExpected,
                    groundRentalsReceived,
                    groundRentalsDue,
                    staffSalariesPayable,
                    staffSalariesPaid,
                    staffSalariesDue,
                    umpireFeesPayable,
                    umpireFeesPaid,
                    umpireFeesDue,
                    // Counts
                    totalUniquePlayers,
                    totalMatchesCount: matchRows.length,
                    totalGroundBookingsCount: groundBookingsList.length,
                    totalPaidStaffCount,
                    totalUmpireDutiesCount: umpireDutiesList.length,
                    totalUmpirePaymentsCount: umpirePaymentDetails.length,
                },
                // Stream 1: Player Program Fees
                playerFees: {
                    expected: playerFeesExpected,
                    received: playerFeesReceived,
                    due: playerFeesDue,
                    programsSummary: programSummaryRows,
                    records: playerFeeRecords,
                    payments: playerPaymentsList,
                },
                // Stream 2: Match Fees (Match-Wise)
                matchFees: {
                    expected: matchFeesExpected,
                    received: matchFeesReceived,
                    due: matchFeesDue,
                    matches: matchRows,
                },
                // Stream 3: Ground Booking Rentals
                groundRentals: {
                    expected: groundRentalsExpected,
                    received: groundRentalsReceived,
                    due: groundRentalsDue,
                    groundsSummary: groundSummaryRows,
                    bookings: groundBookingsList,
                    payments: groundPaymentDetails,
                },
                // Stream 4: Staff & Coach Salaries
                staffSalaries: {
                    payable: staffSalariesPayable,
                    paid: staffSalariesPaid,
                    due: staffSalariesDue,
                    salaries: staffSalaryList,
                },
                // Stream 5: Umpire Fees
                umpireFees: {
                    payable: umpireFeesPayable,
                    paid: umpireFeesPaid,
                    due: umpireFeesDue,
                    duties: umpireDutiesList,
                    payments: umpirePaymentDetails,
                },
            },
        });
    } catch (error) {
        console.error("GET /api/financial-summary error:", error);
        return NextResponse.json(
            { success: false, message: error.message || "Failed to load financial summary." },
            { status: 500 }
        );
    } finally {
        if (connection) connection.release();
    }
}
