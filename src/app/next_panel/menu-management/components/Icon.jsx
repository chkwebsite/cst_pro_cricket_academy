// Minimal stroke-icon set, no external dependency.
// Every icon takes className / size like a normal component.

const base = {
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.6,
    strokeLinecap: "round",
    strokeLinejoin: "round",
};

export function ChevronIcon({ open, size = 12, className }) {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 16 16"
            className={className}
            style={{
                transform: open ? "rotate(90deg)" : "rotate(0deg)",
                transition: "transform 120ms ease",
            }}
            {...base}
        >
            <path d="M5 3l6 5-6 5" />
        </svg>
    );
}

export function PlusIcon({ size = 14, className }) {
    return (
        <svg width={size} height={size} viewBox="0 0 16 16" className={className} {...base}>
            <path d="M8 2v12M2 8h12" />
        </svg>
    );
}

export function EditIcon({ size = 14, className }) {
    return (
        <svg width={size} height={size} viewBox="0 0 16 16" className={className} {...base}>
            <path d="M10.5 2.5l3 3L4.5 14.5H1.5v-3z" />
        </svg>
    );
}

export function TrashIcon({ size = 14, className }) {
    return (
        <svg width={size} height={size} viewBox="0 0 16 16" className={className} {...base}>
            <path d="M3 4.5h10M6 4.5V3a1 1 0 011-1h2a1 1 0 011 1v1.5M12.5 4.5l-.6 8.4a1 1 0 01-1 .9H5.1a1 1 0 01-1-.9l-.6-8.4" />
        </svg>
    );
}

export function XIcon({ size = 14, className }) {
    return (
        <svg width={size} height={size} viewBox="0 0 16 16" className={className} {...base}>
            <path d="M3 3l10 10M13 3L3 13" />
        </svg>
    );
}

export function SearchIcon({ size = 14, className }) {
    return (
        <svg width={size} height={size} viewBox="0 0 16 16" className={className} {...base}>
            <circle cx="7" cy="7" r="4.5" />
            <path d="M13.5 13.5L10.4 10.4" />
        </svg>
    );
}

export function LinkIcon({ size = 12, className }) {
    return (
        <svg width={size} height={size} viewBox="0 0 16 16" className={className} {...base}>
            <path d="M6.5 9.5l3-3M6 5.5H4.5A2.5 2.5 0 002 8v0a2.5 2.5 0 002.5 2.5H6M10 10.5h1.5A2.5 2.5 0 0014 8v0a2.5 2.5 0 00-2.5-2.5H10" />
        </svg>
    );
}

export function KeyIcon({ size = 12, className }) {
    return (
        <svg width={size} height={size} viewBox="0 0 16 16" className={className} {...base}>
            <circle cx="5" cy="5" r="2.5" />
            <path d="M6.8 6.8L13 13M13 13v-2.2M13 13h-2.2" />
        </svg>
    );
}

export function LayersIcon({ size = 12, className }) {
    return (
        <svg width={size} height={size} viewBox="0 0 16 16" className={className} {...base}>
            <path d="M8 2l6 3.2-6 3.2-6-3.2z" />
            <path d="M2 9.2L8 12.4l6-3.2M2 12.4L8 15.6l6-3.2" />
        </svg>
    );
}

export function AlertIcon({ size = 16, className }) {
    return (
        <svg width={size} height={size} viewBox="0 0 16 16" className={className} {...base}>
            <path d="M8 1.5L15 14H1z" />
            <path d="M8 6.2v3.2" />
            <circle cx="8" cy="11.6" r="0.15" fill="currentColor" stroke="none" />
        </svg>
    );
}
