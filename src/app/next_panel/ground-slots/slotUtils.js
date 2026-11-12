// Shared helpers for the ground-slots screens.

// "09:00" -> "09:00:00" (API compares times as strings, so always send HH:MM:SS)
export const toApiTime = (t) => {
    if (!t) return "";
    return t.length === 5 ? `${t}:00` : t;
};

// "09:00:00" -> "09:00" (for <input type="time">)
export const toInputTime = (t) => (t ? String(t).slice(0, 5) : "");

// "14:30:00" -> "2:30 PM"
export const formatTime = (t) => {
    if (!t) return "—";
    const [h, m] = String(t).split(":");
    const hour = Number(h);
    const suffix = hour >= 12 ? "PM" : "AM";
    return `${hour % 12 || 12}:${m} ${suffix}`;
};

export const formatPrice = (p) =>
    `₹${Number(p || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

// The slots API requires academy_id + branch_id on create/update/delete.
// Rows returned by GET /api/ground-slots (and, if your ground API returns them,
// ground rows) already carry both. This is only a fallback for when neither does.
// TODO: wire this to your session/auth context if you have one.
export const getFallbackContext = () => ({
    academy_id: null,
    branch_id: null,
});
