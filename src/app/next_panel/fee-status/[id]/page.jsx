import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Edit, Wallet } from "lucide-react";
import pool from "@/app/components/lib/db";

const STATUS_BADGE = {
    Pending: "bg-warning text-dark",
    Partial: "bg-info text-dark",
    Paid: "bg-success",
    Cancelled: "bg-secondary",
};

const money = (v) => Number(v || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default async function FeeStatusDetailPage({ params }) {
    const { id } = await params;

    if (!Number.isInteger(Number(id)) || Number(id) <= 0) notFound();

    const connection = await pool.getConnection();
    let fee = null;

    try {
        // Same joins as GET /api/fee-status, plus ground booking and creator
        const [rows] = await connection.query(
            `
            SELECT
                fs.*,
                a.academy_name,
                b.branch_name,
                t.tournament_name,
                mt.match_no,
                mt.match_date,
                mt.match_type,
                team_a.team_name AS team_a_name,
                team_b.team_name AS team_b_name,
                mteam_t.team_name AS match_team_name,
                tt_team.team_name AS tournament_team_name,
                g.ground_name,
                u.first_name,
                u.last_name,
                op.player_name AS outside_player_name
            FROM cst_fee_status fs
            LEFT JOIN cst_academy a ON a.id = fs.academy_id
            LEFT JOIN cst_branch b ON b.id = fs.branch_id
            LEFT JOIN cst_tournaments t ON t.id = fs.tournament_id
            LEFT JOIN cst_matches mt ON mt.id = fs.match_id
            LEFT JOIN cst_teams team_a ON team_a.id = mt.team_a_id
            LEFT JOIN cst_teams team_b ON team_b.id = mt.team_b_id
            LEFT JOIN cst_match_teams mteam ON mteam.id = fs.match_team_id
            LEFT JOIN cst_teams mteam_t ON mteam_t.id = mteam.team_id
            LEFT JOIN cst_tournament_teams tt ON tt.id = fs.tournament_team_id
            LEFT JOIN cst_teams tt_team ON tt_team.id = tt.team_id
            LEFT JOIN cst_ground_bookings gb ON gb.id = fs.ground_booking_id
            LEFT JOIN cst_ground g ON g.id = gb.ground_id
            LEFT JOIN cst_users u ON u.id = fs.user_id
            LEFT JOIN cst_outside_players op ON op.id = fs.outside_player_id
            WHERE fs.id = ?
            LIMIT 1
            `,
            [Number(id)]
        );

        if (!rows.length) notFound();
        fee = rows[0];
    } catch (error) {
        if (error?.digest?.startsWith?.("NEXT_")) throw error; // let notFound() through
        console.error("FEE DETAIL ERROR:", error);
        throw new Error("Failed to load fee details");
    } finally {
        connection.release();
    }

    const due = Number(fee.fee_amount || 0) - Number(fee.paid_amount || 0);
    const payerName = [fee.first_name, fee.last_name].filter(Boolean).join(" ") || fee.outside_player_name || fee.tournament_team_name || fee.match_team_name || "—";
    const fixtureTeams = [fee.team_a_name, fee.team_b_name].filter(Boolean).join(" vs ");

    const refs = [
        ["Tournament", fee.tournament_name || fee.tournament_id],
        ["Tournament Team", fee.tournament_team_name ? `${fee.tournament_team_name} (#${fee.tournament_team_id})` : fee.tournament_team_id],
        ["Tournament Player ID", fee.tournament_team_player_id],
        ["Match", fee.match_no || fixtureTeams || (fee.match_id ? "Match details unavailable" : null)],
        ["Fixture", fixtureTeams],
        ["Match Type", fee.match_type],
        ["Match Team", fee.match_team_name ? `${fee.match_team_name} (#${fee.match_team_id})` : fee.match_team_id],
        ["Match Player ID", fee.match_player_id],
        ["Ground", fee.ground_name],
        ["Ground Booking ID", fee.ground_booking_id],
    ].filter(([, v]) => v !== null && v !== undefined && v !== "");

    return (
        <div className="container-fluid">
            <div className="row g-4">
                <div className="col-12">
                    <div className="bg-white rounded-4 shadow-sm p-4 mb-4">
                        <Link href="/next_panel/fee-status" className="btn btn-sm btn-outline-secondary mb-3">
                            <ArrowLeft size={16} className="me-2" /> Back to Fee Status
                        </Link>
                        <div className="d-flex flex-wrap justify-content-between align-items-center gap-3">
                            <div>
                                <div className="d-flex align-items-center gap-2 mb-1">
                                    <Wallet size={22} />
                                    <h1 className="h4 mb-0">Fee Details</h1>
                                </div>
                                <p className="text-muted mb-0">{fee.fee_type} · Record #{fee.id}</p>
                            </div>
                            <Link href={`/next_panel/fee-status/${fee.id}/edit`} className="btn btn-primary">
                                <Edit size={16} className="me-2" /> Edit fee
                            </Link>
                        </div>
                    </div>
                </div>

                <div className="col-lg-6">
                    <div className="bg-white rounded-4 shadow-sm p-4 h-100">
                        <h2 className="h6 mb-3">Payment</h2>
                        <div className="row g-3">
                            <div className="col-md-6">
                                <label className="text-muted small">Fee Amount</label>
                                <div className="fw-semibold">₹{money(fee.fee_amount)}</div>
                            </div>
                            <div className="col-md-6">
                                <label className="text-muted small">Paid Amount</label>
                                <div className="fw-semibold">₹{money(fee.paid_amount)}</div>
                            </div>
                            <div className="col-md-6">
                                <label className="text-muted small">Due</label>
                                <div className="fw-semibold">{fee.status === "Cancelled" ? "—" : `₹${money(due)}`}</div>
                            </div>
                            <div className="col-md-6">
                                <label className="text-muted small">Status</label>
                                <div>
                                    <span className={`badge ${STATUS_BADGE[fee.status] || "bg-secondary"}`}>{fee.status}</span>
                                </div>
                            </div>
                            <div className="col-12">
                                <label className="text-muted small">Remarks</label>
                                <div>{fee.remarks || "—"}</div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="col-lg-6">
                    <div className="bg-white rounded-4 shadow-sm p-4 h-100">
                        <h2 className="h6 mb-3">Fee Info</h2>
                        <div className="row g-3">
                            <div className="col-md-6">
                                <label className="text-muted small">Academy</label>
                                <div className="fw-semibold">{fee.academy_name || "—"}</div>
                            </div>
                            <div className="col-md-6">
                                <label className="text-muted small">Branch</label>
                                <div className="fw-semibold">{fee.branch_name || "—"}</div>
                            </div>
                            <div className="col-md-6">
                                <label className="text-muted small">Payer</label>
                                <div className="fw-semibold">
                                    {payerName || (fee.outside_player_id ? `Outside player #${fee.outside_player_id}` : "—")}
                                </div>
                            </div>
                            <div className="col-md-6">
                                <label className="text-muted small">Fee Type</label>
                                <div className="fw-semibold">{fee.fee_type}</div>
                            </div>
                            {refs.map(([label, value]) => (
                                <div className="col-md-6" key={label}>
                                    <label className="text-muted small">{label}</label>
                                    <div className="fw-semibold">{String(value)}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
