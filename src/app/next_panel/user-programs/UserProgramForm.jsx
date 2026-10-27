"use client";

import { useEffect, useState } from "react";

const emptyUserProgram = {
    user_id: "",
    program_id: "",
    branch_id: "",
    admission_players_id: "",
    start_date: "",
    end_date: "",
    status: 1,
    paid_amount: "",
    payment_mode: "Cash",
    transaction_no: "",
    payment_remarks: "",
};

export function getEmptyUserProgram() { return { ...emptyUserProgram }; }

export function buildUserProgramPayload(values) {
    return {
        user_id: values.user_id ? Number(values.user_id) : null,
        program_id: Number(values.program_id),
        branch_id: Number(values.branch_id),
        admission_players_id: Number(values.admission_players_id),
        start_date: values.start_date || null,
        end_date: values.end_date || null,
        status: Number(values.status),
        paid_amount: values.paid_amount ? Number(values.paid_amount) : 0,
        payment_mode: values.payment_mode || "Cash",
        transaction_no: values.transaction_no || null,
        payment_remarks: values.payment_remarks || null,
    };
}

async function readJson(res) {
    const text = await res.text();
    if (!text) return {};
    try { return JSON.parse(text); } catch { return { message: text }; }
}

export default function UserProgramForm({ formId, values, onChange, onSubmit, error, loading = false }) {
    const [users, setUsers] = useState([]);
    const [programs, setPrograms] = useState([]);
    const [branches, setBranches] = useState([]);
    const [players, setPlayers] = useState([]);
    const [optionsError, setOptionsError] = useState(null);

    useEffect(() => {
        async function loadOptions() {
            try {
                const [u, p, b, pl] = await Promise.all([
                    fetch("/api/users?user_type=Player&limit=1000"),
                    fetch("/api/programs?status=1"),
                    fetch("/api/branch?status=1"),
                    fetch("/api/admission-players?status=1"),
                ]);
                const [uj, pj, bj, plj] = await Promise.all([readJson(u), readJson(p), readJson(b), readJson(pl)]);
                if (!u.ok) throw new Error(uj.message || "Unable to load users.");
                if (!p.ok) throw new Error(pj.message || "Unable to load programs.");
                if (!b.ok) throw new Error(bj.message || "Unable to load branches.");
                if (!pl.ok) throw new Error(plj.message || "Unable to load admission players.");
                const loadedUsers = (uj.data || []).filter((u) => u.user_type === "Player");
                const loadedPlayers = plj.data || [];
                setUsers(loadedUsers);
                setPrograms(pj.data || []);
                setBranches(bj.data || []);
                setPlayers(loadedPlayers);

                if (!values.branch_id) {
                    const plMatch = loadedPlayers.find((p) => String(p.id) === String(values.admission_players_id));
                    const uMatch = loadedUsers.find((u) => String(u.id) === String(values.user_id));
                    const autoBranch = plMatch?.branch_id || uMatch?.branch_id;
                    if (autoBranch) {
                        onChange({ ...values, branch_id: String(autoBranch) });
                    }
                }
            } catch (err) { setOptionsError(err.message); }
        }
        loadOptions();
    }, []);

    const change = (field) => (e) => onChange({ ...values, [field]: field === "status" ? Number(e.target.value) : e.target.value });

    const handleUserChange = (e) => {
        const userId = e.target.value;
        const selectedUser = users.find((u) => String(u.id) === String(userId));
        const matchingPlayer = userId ? players.find((p) => String(p.user_id) === String(userId)) : null;

        const nextBranchId = matchingPlayer?.branch_id || selectedUser?.branch_id;
        const nextPlayerId = matchingPlayer ? matchingPlayer.id : values.admission_players_id;

        onChange({
            ...values,
            user_id: userId,
            branch_id: nextBranchId ? String(nextBranchId) : values.branch_id,
            admission_players_id: nextPlayerId ? String(nextPlayerId) : values.admission_players_id,
        });
    };

    const handlePlayerChange = (e) => {
        const playerId = e.target.value;
        const selectedPlayer = players.find((p) => String(p.id) === String(playerId));
        const matchingUser = selectedPlayer?.user_id
            ? users.find((u) => String(u.id) === String(selectedPlayer.user_id))
            : null;

        const nextBranchId = selectedPlayer?.branch_id || matchingUser?.branch_id;
        const nextUserId = selectedPlayer?.user_id ? String(selectedPlayer.user_id) : values.user_id;

        onChange({
            ...values,
            admission_players_id: playerId,
            branch_id: nextBranchId ? String(nextBranchId) : values.branch_id,
            user_id: nextUserId,
        });
    };

    return (
        <form id={formId} onSubmit={onSubmit}>
            {error && <div className="alert alert-danger">{error}</div>}
            {optionsError && <div className="alert alert-warning">{optionsError}</div>}
            <div className="row g-3">
                <div className="col-md-6">
                    <label className="form-label">User</label>
                    <select className="form-select" value={values.user_id} onChange={handleUserChange} disabled={loading}>
                        <option value="">Select user</option>
                        {users.filter(u => u.user_type === "Player").map(u => <option key={u.id} value={u.id}>{[u.first_name, u.last_name].filter(Boolean).join(" ") || `User #${u.id}`} ({u.appointment_no || u.apointment_no || u.email || u.id})</option>)}
                    </select>
                </div>
                <div className="col-md-6">
                    <label className="form-label">Admission Player <span className="text-danger">*</span></label>
                    <select className="form-select" value={values.admission_players_id} onChange={handlePlayerChange} required disabled={loading}>
                        <option value="">Select admission player</option>
                        {players.map(p => <option key={p.id} value={p.id}>{[p.first_name, p.last_name].filter(Boolean).join(" ") || p.name || `Player #${p.id}`} (#{p.id})</option>)}
                    </select>
                </div>
                <div className="col-md-6">
                    <label className="form-label">Program <span className="text-danger">*</span></label>
                    <select className="form-select" value={values.program_id} onChange={change("program_id")} required disabled={loading}>
                        <option value="">Select program</option>
                        {programs.map(p => <option key={p.id} value={p.id}>{p.program_name || p.name || `Program #${p.id}`}</option>)}
                    </select>
                </div>
                <div className="col-md-6">
                    <label className="form-label">Branch <span className="text-danger">*</span></label>
                    <select className="form-select" value={values.branch_id} onChange={change("branch_id")} required disabled={loading}>
                        <option value="">Select branch</option>
                        {branches.map(b => <option key={b.id} value={b.id}>{b.branch_name} ({b.branch_code})</option>)}
                    </select>
                </div>
                <div className="col-md-4">
                    <label className="form-label">Start Date</label>
                    <input type="date" className="form-control" value={values.start_date || ""} onChange={change("start_date")} disabled={loading} />
                </div>
                <div className="col-md-4">
                    <label className="form-label">End Date</label>
                    <input type="date" className="form-control" value={values.end_date || ""} onChange={change("end_date")} disabled={loading} />
                </div>
                <div className="col-md-4">
                    <label className="form-label">Status</label>
                    <select className="form-select" value={values.status} onChange={change("status")} disabled={loading}>
                        <option value={1}>Active</option><option value={0}>Inactive</option>
                    </select>
                </div>

                {/* Program Fee & Initial Payment Section */}
                {(() => {
                    const selProg = programs.find((p) => String(p.id) === String(values.program_id));
                    const feeAmt = Number(selProg?.program_fee || 0);
                    const regAmt = Number(selProg?.registration_fee || 0);
                    const kitAmt = Number(selProg?.kit_fee || 0);
                    const totalAmt = feeAmt + regAmt + kitAmt;

                    return (
                        <div className="col-12 mt-3">
                            <div className="card bg-light border-0 p-3">
                                <h6 className="fw-bold mb-2">Program Fee & Initial Payment (Optional)</h6>
                                {selProg ? (
                                    <div className="small text-muted mb-3 d-flex flex-wrap gap-3">
                                        <span>Program Fee: <strong>₹{feeAmt.toFixed(2)}</strong></span>
                                        <span>Registration Fee: <strong>₹{regAmt.toFixed(2)}</strong></span>
                                        {kitAmt > 0 && <span>Kit Fee: <strong>₹{kitAmt.toFixed(2)}</strong></span>}
                                        <span className="text-primary">Total Expected: <strong>₹{totalAmt.toFixed(2)}</strong></span>
                                    </div>
                                ) : (
                                    <p className="small text-muted mb-2">Select a program above to preview fee breakdown.</p>
                                )}
                                <div className="row g-2">
                                    <div className="col-md-3">
                                        <label className="form-label small">Paid Amount (₹)</label>
                                        <input
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            className="form-control form-control-sm"
                                            placeholder="0.00"
                                            value={values.paid_amount || ""}
                                            onChange={change("paid_amount")}
                                            disabled={loading}
                                        />
                                    </div>
                                    <div className="col-md-3">
                                        <label className="form-label small">Payment Mode</label>
                                        <select
                                            className="form-select form-select-sm"
                                            value={values.payment_mode || "Cash"}
                                            onChange={change("payment_mode")}
                                            disabled={loading}
                                        >
                                            <option value="Cash">Cash</option>
                                            <option value="UPI">UPI / QR</option>
                                            <option value="Card">Card</option>
                                            <option value="Bank Transfer">Bank Transfer</option>
                                            <option value="Cheque">Cheque</option>
                                        </select>
                                    </div>
                                    <div className="col-md-3">
                                        <label className="form-label small">Transaction / Ref No</label>
                                        <input
                                            type="text"
                                            className="form-control form-control-sm"
                                            placeholder="UPI / Cheque / Ref #"
                                            value={values.transaction_no || ""}
                                            onChange={change("transaction_no")}
                                            disabled={loading}
                                        />
                                    </div>
                                    <div className="col-md-3">
                                        <label className="form-label small">Payment Remarks</label>
                                        <input
                                            type="text"
                                            className="form-control form-control-sm"
                                            placeholder="Remarks"
                                            value={values.payment_remarks || ""}
                                            onChange={change("payment_remarks")}
                                            disabled={loading}
                                        />
                                    </div>
                                </div>
                                <div className="form-text mt-1 text-muted small">
                                    A monthly fee invoice and attendance record will be automatically generated upon saving.
                                </div>
                            </div>
                        </div>
                    );
                })()}
            </div>
        </form>
    );
}
