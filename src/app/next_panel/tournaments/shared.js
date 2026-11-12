// Shared constants and helpers for the tournaments screens.

export const BASE = "/next_panel/tournaments";

// Branch list used by the form. Change this if your branches endpoint is different.
// Expected response: { success: true, data: [{ id, branch_name, academy_id }] }
export const BRANCHES_URL = "/api/branches";

// The API defaults to "Round Robin" and "Draft" and uses "Cancelled" on delete.
// The other values are suggestions - match them to your database column.
export const TOURNAMENT_TYPES = ["Round Robin", "Knockout", "League", "Group + Knockout"];
export const STATUSES = [
    "Draft",
    "Registration Open",
    "Registration Closed",
    "Running",
    "Completed",
    "Cancelled",
];

export const STATUS_BADGE = {
    Draft: "bg-secondary",
    "Registration Open": "bg-info text-dark",
    "Registration Closed": "bg-warning text-dark",
    Running: "bg-primary",
    Ongoing: "bg-primary",
    Completed: "bg-success",
    Cancelled: "bg-danger",
};

const pad = (n) => String(n).padStart(2, "0");

// API date columns can arrive as "2026-10-08" or as a full ISO timestamp.
// Read timestamps in local time so the date doesn't shift by a day.
export function toDateInput(value) {
    if (!value) return "";
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "";
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function formatDate(value) {
    const key = toDateInput(value);
    if (!key) return "-";
    const [y, m, d] = key.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric",
    });
}

export const formatFee = (fee) => {
    const n = Number(fee);
    return n > 0 ? `₹${n.toFixed(2)}` : "Free";
};
