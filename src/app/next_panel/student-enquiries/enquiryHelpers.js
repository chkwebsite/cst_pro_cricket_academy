export const ENQUIRY_STATUSES = [
    "New",
    "Contacted",
    "Follow-up",
    "Interested",
    "Converted",
    "Not Interested",
    "Closed",
];

export const FOLLOWUP_STATUSES = [
    "Contacted",
    "Follow-up",
    "Interested",
    "Converted",
    "Not Interested",
    "Closed",
];

export const ENQUIRY_SOURCES = [
    "Website",
    "Phone",
    "Walk-in",
    "Referral",
    "Other",
];

export const STATUS_BADGE = {
    New: "bg-primary text-white",
    Contacted: "bg-info text-dark",
    "Follow-up": "bg-warning text-dark",
    Interested: "bg-primary-subtle text-primary border border-primary-subtle",
    Converted: "bg-success text-white",
    "Not Interested": "bg-secondary text-white",
    Closed: "bg-dark text-white",
};

export const SOURCE_BADGE = {
    Website: "bg-light text-primary border",
    Phone: "bg-light text-success border",
    "Walk-in": "bg-light text-warning-emphasis border",
    Referral: "bg-light text-info-emphasis border",
    Other: "bg-light text-secondary border",
};

export function formatDate(value) {
    if (!value) return "—";
    try {
        const d = new Date(value);
        if (Number.isNaN(d.getTime())) return String(value).slice(0, 10);
        return d.toLocaleDateString("en-IN", {
            day: "2-digit",
            month: "short",
            year: "numeric",
        });
    } catch {
        return "—";
    }
}

export function formatDateTime(value) {
    if (!value) return "—";
    try {
        const d = new Date(value);
        if (Number.isNaN(d.getTime())) return String(value);
        return d.toLocaleDateString("en-IN", {
            day: "2-digit",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    } catch {
        return "—";
    }
}
