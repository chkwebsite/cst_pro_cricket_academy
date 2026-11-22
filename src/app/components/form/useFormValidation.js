"use client";

import { useState, useCallback } from "react";

/**
 * Standard hook for form-level and field-level validation across Next.js forms.
 * Supports on-blur validation, on-change correction clearing, submit-time validation,
 * automatic scrolling/focusing on first invalid field, and API error mapping.
 */
export function useFormValidation(initialErrors = {}) {
    const [errors, setErrors] = useState(initialErrors);
    const [touched, setTouched] = useState({});
    const [isSubmitted, setIsSubmitted] = useState(false);

    /**
     * Clear error for a specific field
     */
    const clearError = useCallback((fieldName) => {
        setErrors((prev) => {
            if (!prev[fieldName]) return prev;
            const updated = { ...prev };
            delete updated[fieldName];
            return updated;
        });
    }, []);

    /**
     * Set error for a specific field
     */
    const setError = useCallback((fieldName, message) => {
        setErrors((prev) => ({
            ...prev,
            [fieldName]: message,
        }));
    }, []);

    /**
     * Clear all errors
     */
    const clearAllErrors = useCallback(() => {
        setErrors({});
        setIsSubmitted(false);
    }, []);

    /**
     * Mark a field as touched and validate on blur
     */
    const handleBlur = useCallback((fieldName, value, ruleFn) => {
        setTouched((prev) => ({ ...prev, [fieldName]: true }));
        if (ruleFn) {
            const errorMsg = ruleFn(value);
            if (errorMsg) {
                setErrors((prev) => ({ ...prev, [fieldName]: errorMsg }));
            } else {
                clearError(fieldName);
            }
        }
    }, [clearError]);

    /**
     * Handle input change: if field is already touched or has an error or form was submitted,
     * re-evaluate and clear the error immediately when user corrects it.
     */
    const handleChange = useCallback((fieldName, value, ruleFn) => {
        if (ruleFn) {
            const errorMsg = ruleFn(value);
            if (!errorMsg) {
                clearError(fieldName);
            } else if (touched[fieldName] || isSubmitted || errors[fieldName]) {
                setErrors((prev) => ({ ...prev, [fieldName]: errorMsg }));
            }
        } else if (errors[fieldName]) {
            clearError(fieldName);
        }
    }, [clearError, errors, isSubmitted, touched]);

    /**
     * Validate the entire form against a schema of rule functions.
     * Schema format: { fieldName: (value, allValues) => errorMessage | null, ... }
     */
    const validateForm = useCallback((values, schema) => {
        setIsSubmitted(true);
        const newErrors = {};
        const newTouched = {};

        for (const [fieldName, ruleFn] of Object.entries(schema)) {
            newTouched[fieldName] = true;
            if (typeof ruleFn === "function") {
                const errorMsg = ruleFn(values[fieldName], values);
                if (errorMsg) {
                    newErrors[fieldName] = errorMsg;
                }
            }
        }

        setTouched(newTouched);
        setErrors(newErrors);

        const errorKeys = Object.keys(newErrors);
        const isValid = errorKeys.length === 0;

        // Auto-focus and scroll to the first invalid field
        if (!isValid && typeof document !== "undefined") {
            const firstField = errorKeys[0];
            setTimeout(() => {
                const element = document.querySelector(
                    `[name="${firstField}"], #${firstField}, [id^="${firstField}"]`
                );
                if (element) {
                    element.focus({ preventScroll: false });
                    element.scrollIntoView({ behavior: "smooth", block: "center" });
                }
            }, 50);
        }

        return { isValid, errors: newErrors };
    }, []);

    /**
     * Map structured backend API validation errors directly into the form's error state.
     * Handles { success: false, errors: { email: "...", phone: "..." } }
     */
    const handleApiErrors = useCallback((apiResponse) => {
        if (!apiResponse) return;

        if (apiResponse.errors && typeof apiResponse.errors === "object") {
            setErrors((prev) => ({
                ...prev,
                ...apiResponse.errors,
            }));
            const firstField = Object.keys(apiResponse.errors)[0];
            if (firstField && typeof document !== "undefined") {
                setTimeout(() => {
                    const element = document.querySelector(`[name="${firstField}"], #${firstField}`);
                    if (element) {
                        element.focus({ preventScroll: false });
                        element.scrollIntoView({ behavior: "smooth", block: "center" });
                    }
                }, 50);
            }
            return true;
        }

        return false;
    }, []);

    return {
        errors,
        setErrors,
        touched,
        setTouched,
        isSubmitted,
        setIsSubmitted,
        setError,
        clearError,
        clearAllErrors,
        handleBlur,
        handleChange,
        validateForm,
        handleApiErrors,
    };
}
