// Shared helpers for the ground-bookings screens.

// Values the API clearly uses: Booked, Confirmed (duplicate check), Pending/Partial/Paid (payment).
// Completed / Cancelled and the payment modes are assumptions - align with your DB enums.
export const BOOKING_STATUSES = ["Booked", "Confirmed", "Completed", "Cancelled"];
export const PAYMENT_STATUSES = ["Pending", "Partial", "Paid"];
export const PAYMENT_MODES = ["Cash", "UPI", "Card", "Bank Transfer", "Cheque"];
export const PURPOSES = ["Practice", "Match", "Tournament", "Coaching", "Event"];

export const normalizePurpose = (p) => {
    if (!p) return "Practice";
    const lower = String(p).toLowerCase().trim();
    if (lower.includes("practice")) return "Practice";
    if (lower.includes("match")) return "Match";
    if (lower.includes("tournament")) return "Tournament";
    if (lower.includes("coaching") || lower.includes("coach")) return "Coaching";
    if (lower.includes("event") || lower.includes("corporate")) return "Event";
    if (PURPOSES.includes(p)) return p;
    return "Practice";
};

export const formatTime = (t) => {
    if (!t) return "—";
    const [h, m] = String(t).split(":");
    const hour = Number(h);
    return `${hour % 12 || 12}:${m} ${hour >= 12 ? "PM" : "AM"}`;
};

export const formatPrice = (p) =>
    `₹${Number(p || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

// MySQL DATE may arrive as "2026-10-07" or as an ISO datetime. Read it with
// local getters so the day doesn't shift across time zones (e.g. IST vs UTC).
export const toDateInput = (value) => {
    if (!value) return "";
    const s = String(value);
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    const d = new Date(s);
    if (isNaN(d)) return s.slice(0, 10);
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

export const formatDate = (value) => {
    const iso = toDateInput(value);
    if (!iso) return "—";
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
    });
};

// Mirrors the server's payment-status rules
export const derivePaymentStatus = (total, paid) => {
    const t = Number(total) || 0;
    const p = Number(paid) || 0;
    if (t > 0 && p === t) return "Paid";
    if (p > 0 && p < t) return "Partial";
    return "Pending";
};

export const bookingBadge = (s) =>
({ Booked: "bg-info", Confirmed: "bg-success", Completed: "bg-primary", Cancelled: "bg-danger" }[s] ||
    "bg-secondary");

export const paymentBadge = (s) =>
    ({ Paid: "bg-success", Partial: "bg-warning text-dark", Pending: "bg-secondary" }[s] || "bg-secondary");
