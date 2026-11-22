import { NextResponse } from "next/server";

/**
 * Creates a standard JSON error response for API validation failures.
 * Matches the required response shape:
 * {
 *   "success": false,
 *   "message": "Validation failed",
 *   "errors": { "field": "Error description" }
 * }
 */
export function validationErrorResponse(errors, message = "Validation failed", status = 400) {
    return NextResponse.json(
        {
            success: false,
            message,
            errors,
        },
        { status }
    );
}

/**
 * Validates request payload against schema rules.
 * Schema format: { fieldName: (value, body) => errorMsg | null }
 * Returns { isValid: boolean, errors: object }
 */
export function validateApiPayload(body, schema) {
    const errors = {};
    for (const [field, validator] of Object.entries(schema)) {
        if (typeof validator === "function") {
            const error = validator(body[field], body);
            if (error) {
                errors[field] = error;
            }
        }
    }
    return {
        isValid: Object.keys(errors).length === 0,
        errors,
    };
}
