"use client";

import React from "react";

/**
 * Renders a form field label with a standardized red (*) indicator when required.
 * Ensures "(Optional)" text is never rendered.
 */
export function RequiredLabel({ label, required = false, htmlFor, className = "form-label" }) {
    if (!label) return null;
    return (
        <label htmlFor={htmlFor} className={className}>
            {label}
            {required && <span className="text-danger ms-1" style={{ color: "#dc3545" }}>*</span>}
        </label>
    );
}

/**
 * Standard inline field error message directly below the input/select.
 * Renders in red with readable 13px font.
 */
export function FormError({ error }) {
    if (!error) return null;
    return (
        <div
            className="invalid-feedback d-block text-danger mt-1"
            style={{ fontSize: "13px", color: "#dc3545" }}
            role="alert"
        >
            {error}
        </div>
    );
}

/**
 * Generic wrapper for custom inputs or grouped controls.
 */
export function FormField({
    label,
    required = false,
    error = null,
    helpText = null,
    htmlFor,
    className = "",
    children,
}) {
    return (
        <div className={className}>
            {label && <RequiredLabel label={label} required={required} htmlFor={htmlFor} />}
            {children}
            <FormError error={error} />
            {helpText && !error && <div className="form-text">{helpText}</div>}
        </div>
    );
}

/**
 * Standardized Input Field with inline validation & red border indicator.
 */
export function FormInput({
    label,
    required = false,
    error = null,
    helpText = null,
    className = "",
    inputClassName = "",
    id,
    name,
    type = "text",
    value,
    onChange,
    onBlur,
    placeholder,
    disabled = false,
    ...props
}) {
    const hasError = Boolean(error);
    const inputId = id || name;

    return (
        <div className={className}>
            {label && <RequiredLabel label={label} required={required} htmlFor={inputId} />}
            <input
                id={inputId}
                name={name}
                type={type}
                className={`form-control ${hasError ? "is-invalid border-danger" : ""} ${inputClassName}`.trim()}
                style={hasError ? { borderColor: "#dc3545" } : {}}
                value={value ?? ""}
                onChange={onChange}
                onBlur={onBlur}
                placeholder={placeholder}
                disabled={disabled}
                aria-invalid={hasError}
                {...props}
            />
            <FormError error={error} />
            {helpText && !hasError && <div className="form-text">{helpText}</div>}
        </div>
    );
}

/**
 * Standardized Select Field with inline validation & red border indicator.
 */
export function FormSelect({
    label,
    required = false,
    error = null,
    helpText = null,
    className = "",
    selectClassName = "",
    id,
    name,
    value,
    onChange,
    onBlur,
    options,
    placeholder = "Select an option",
    children,
    disabled = false,
    ...props
}) {
    const hasError = Boolean(error);
    const selectId = id || name;

    return (
        <div className={className}>
            {label && <RequiredLabel label={label} required={required} htmlFor={selectId} />}
            <select
                id={selectId}
                name={name}
                className={`form-select ${hasError ? "is-invalid border-danger" : ""} ${selectClassName}`.trim()}
                style={hasError ? { borderColor: "#dc3545" } : {}}
                value={value ?? ""}
                onChange={onChange}
                onBlur={onBlur}
                disabled={disabled}
                aria-invalid={hasError}
                {...props}
            >
                {placeholder && <option value="">{placeholder}</option>}
                {options
                    ? options.map((opt) => (
                          <option key={opt.value ?? opt.id} value={opt.value ?? opt.id}>
                              {opt.label ?? opt.name}
                          </option>
                      ))
                    : children}
            </select>
            <FormError error={error} />
            {helpText && !hasError && <div className="form-text">{helpText}</div>}
        </div>
    );
}

/**
 * Standardized Textarea Field with inline validation & red border indicator.
 */
export function FormTextarea({
    label,
    required = false,
    error = null,
    helpText = null,
    className = "",
    textareaClassName = "",
    id,
    name,
    value,
    onChange,
    onBlur,
    rows = 3,
    placeholder,
    disabled = false,
    ...props
}) {
    const hasError = Boolean(error);
    const textareaId = id || name;

    return (
        <div className={className}>
            {label && <RequiredLabel label={label} required={required} htmlFor={textareaId} />}
            <textarea
                id={textareaId}
                name={name}
                rows={rows}
                className={`form-control ${hasError ? "is-invalid border-danger" : ""} ${textareaClassName}`.trim()}
                style={hasError ? { borderColor: "#dc3545" } : {}}
                value={value ?? ""}
                onChange={onChange}
                onBlur={onBlur}
                placeholder={placeholder}
                disabled={disabled}
                aria-invalid={hasError}
                {...props}
            />
            <FormError error={error} />
            {helpText && !hasError && <div className="form-text">{helpText}</div>}
        </div>
    );
}
