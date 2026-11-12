// Helper utilities for Ground Booking Requests in next_panel

export const REQUEST_STATUSES = ["Pending", "Approved", "Rejected", "Cancelled"];

export const BOOKING_PURPOSES = [
    "Practice Session",
    "Friendly Match",
    "Tournament",
    "Corporate Event",
    "Other",
];

export const formatTime = (t) => {
    if (!t) return "—";
    const parts = String(t).split(":");
    const h = Number(parts[0]);
    const m = parts[1] || "00";
    if (isNaN(h)) return String(t);
    const hour = h % 12 || 12;
    const ampm = h >= 12 ? "PM" : "AM";
    return `${String(hour).padStart(2, "0")}:${m} ${ampm}`;
};

export const formatTimeRange = (start, end) => {
    if (!start && !end) return "—";
    return `${formatTime(start)} - ${formatTime(end)}`;
};

export const toDateInput = (value) => {
    if (!value) return "";
    const s = String(value);
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    const d = new Date(s);
    if (isNaN(d.getTime())) return s.slice(0, 10);
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

export const buildConvertBookingHref = (req) => {
    if (!req) return "/next_panel/ground-bookings/new";
    const params = new URLSearchParams();
    if (req.id) params.set("request_id", String(req.id));
    if (req.request_number) params.set("request_number", String(req.request_number));
    if (req.ground_id) params.set("ground_id", String(req.ground_id));
    if (req.customer_name) params.set("customer_name", req.customer_name);
    if (req.mobile) params.set("customer_phone", req.mobile);
    if (req.email) params.set("customer_email", req.email);
    if (req.booking_date) params.set("booking_date", toDateInput(req.booking_date));
    if (req.booking_purpose) params.set("purpose", req.booking_purpose);
    if (req.start_time) params.set("start_time", String(req.start_time));
    if (req.end_time) params.set("end_time", String(req.end_time));
    if (req.special_requirements) {
        params.set("remarks", req.special_requirements);
    } else if (req.request_number) {
        params.set("remarks", `Converted from Request #${req.request_number}`);
    }
    return `/next_panel/ground-bookings/new?${params.toString()}`;
};

export const statusBadge = (status) => {
    switch (status) {
        case "Approved":
            return "bg-success text-white";
        case "Pending":
            return "bg-warning text-dark";
        case "Rejected":
            return "bg-danger text-white";
        case "Cancelled":
            return "bg-secondary text-white";
        default:
            return "bg-secondary text-white";
    }
};

export const purposeBadge = (purpose) => {
    switch (purpose) {
        case "Tournament":
            return "bg-primary text-white";
        case "Corporate Event":
            return "bg-info text-dark";
        case "Friendly Match":
            return "bg-dark text-white";
        case "Practice Session":
            return "bg-light text-dark border";
        default:
            return "bg-secondary text-white";
    }
};
