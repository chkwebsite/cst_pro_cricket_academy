/**
 * Central Form Validation Rules & Utilities
 * Provides consistent validation across all frontend forms and backend APIs.
 */

export const REGEX_PATTERNS = {
    email: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
    phone: /^[0-9+\s\-()]{10,15}$/,
    indianPhone: /^[6-9]\d{9}$/,
    alphanumeric: /^[a-zA-Z0-9\s_-]+$/,
    pinCode: /^\d{6}$/,
    positiveNumber: /^\d+(\.\d+)?$/,
};

/**
 * Validate required field (strings, numbers, arrays, booleans)
 */
export function validateRequired(value, fieldLabel = "This field") {
    if (value === null || value === undefined) {
        return `${fieldLabel} is required.`;
    }
    if (typeof value === "string" && !value.trim()) {
        return `${fieldLabel} is required.`;
    }
    if (Array.isArray(value) && value.length === 0) {
        return `Please select at least one ${fieldLabel.toLowerCase()}.`;
    }
    return null;
}

/**
 * Validate email format
 */
export function validateEmail(value, fieldLabel = "Email address") {
    if (!value || typeof value !== "string" || !value.trim()) return null; // let required check handle empty
    const trimmed = value.trim();
    if (!REGEX_PATTERNS.email.test(trimmed)) {
        return `Please enter a valid ${fieldLabel.toLowerCase()} (e.g. name@example.com).`;
    }
    return null;
}

/**
 * Validate phone number
 */
export function validatePhone(value, fieldLabel = "Phone number") {
    if (!value || typeof value !== "string" || !value.trim()) return null;
    const digitsOnly = value.replace(/\D/g, "");
    if (digitsOnly.length < 10 || digitsOnly.length > 15) {
        return `Please enter a valid ${fieldLabel.toLowerCase()} (at least 10 digits).`;
    }
    return null;
}

/**
 * Validate select/dropdown field
 */
export function validateSelect(value, fieldLabel = "an option") {
    if (value === null || value === undefined || value === "" || value === 0 || value === "0") {
        // Note: 0 might be inactive in status, so check explicitly if field is status
        if (value === 0 || value === "0") return null;
        return `Please select ${fieldLabel.toLowerCase().startsWith("a") ? fieldLabel : "a " + fieldLabel}.`;
    }
    return null;
}

/**
 * Validate numeric value and bounds
 */
export function validateNumeric(value, fieldLabel = "Value", { min = null, max = null, integerOnly = false } = {}) {
    if (value === null || value === undefined || value === "") return null;
    const num = Number(value);
    if (isNaN(num)) {
        return `${fieldLabel} must be a valid number.`;
    }
    if (integerOnly && !Number.isInteger(num)) {
        return `${fieldLabel} must be an integer.`;
    }
    if (min !== null && num < min) {
        return `${fieldLabel} must be at least ${min}.`;
    }
    if (max !== null && num > max) {
        return `${fieldLabel} cannot exceed ${max}.`;
    }
    return null;
}

/**
 * Validate string length
 */
export function validateLength(value, fieldLabel = "Field", { min = null, max = null } = {}) {
    if (!value || typeof value !== "string") return null;
    const len = value.trim().length;
    if (min !== null && len < min) {
        return `${fieldLabel} must be at least ${min} characters.`;
    }
    if (max !== null && len > max) {
        return `${fieldLabel} cannot exceed ${max} characters.`;
    }
    return null;
}

/**
 * Validate date
 */
export function validateDate(value, fieldLabel = "Date", { minDate = null, maxDate = null } = {}) {
    if (!value) return null;
    const d = new Date(value);
    if (isNaN(d.getTime())) {
        return `Please enter a valid ${fieldLabel.toLowerCase()}.`;
    }
    if (minDate && new Date(value) < new Date(minDate)) {
        return `${fieldLabel} cannot be earlier than ${minDate}.`;
    }
    if (maxDate && new Date(value) > new Date(maxDate)) {
        return `${fieldLabel} cannot be later than ${maxDate}.`;
    }
    return null;
}

/**
 * Validate date range
 */
export function validateDateRange(startDate, endDate, startLabel = "Start Date", endLabel = "End Date") {
    if (!startDate || !endDate) return null;
    if (new Date(startDate) > new Date(endDate)) {
        return `${endLabel} must be after ${startLabel}.`;
    }
    return null;
}

/**
 * Validate password strength
 */
export function validatePassword(value, fieldLabel = "Password", minLength = 6) {
    if (!value) return null;
    if (value.length < minLength) {
        return `${fieldLabel} must be at least ${minLength} characters long.`;
    }
    return null;
}

/**
 * Validate confirm password
 */
export function validateConfirmPassword(confirmValue, originalValue) {
    if (!confirmValue) return null;
    if (confirmValue !== originalValue) {
        return "Passwords do not match.";
    }
    return null;
}

/**
 * Validate Pin Code
 */
export function validatePinCode(value, fieldLabel = "PIN code") {
    if (!value || !value.trim()) return null;
    if (!/^\d{6}$/.test(value.trim())) {
        return `Please enter a valid 6-digit ${fieldLabel.toLowerCase()}.`;
    }
    return null;
}

/**
 * Validate file upload
 */
export function validateFileUpload(file, { maxSizeMB = 5, allowedTypes = [] } = {}) {
    if (!file) return null;
    const maxBytes = maxSizeMB * 1024 * 1024;
    if (file.size > maxBytes) {
        return `File size exceeds ${maxSizeMB}MB limit.`;
    }
    if (allowedTypes.length > 0) {
        const fileExt = file.name ? file.name.split('.').pop().toLowerCase() : '';
        const isMimeAllowed = allowedTypes.includes(file.type);
        const isExtAllowed = allowedTypes.some(type => type.toLowerCase().includes(fileExt));
        if (!isMimeAllowed && !isExtAllowed) {
            return `File type not supported. Allowed: ${allowedTypes.join(', ')}`;
        }
    }
    return null;
}
