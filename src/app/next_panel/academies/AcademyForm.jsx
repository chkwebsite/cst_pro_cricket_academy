"use client";

import { useRef, useState, useEffect } from "react";
import { Image as ImageIcon, Upload, X } from "lucide-react";
import { FormError } from "@/app/components/form";
import { validateEmail, validatePhone, validatePinCode } from "@/app/components/form";

const emptyAcademy = {
    academy_name: "",
    academy_code: "",
    contact_person: "",
    email: "",
    phone: "",
    website: "",
    address: "",
    city: "",
    state: "",
    pin_code: "",
    gst_no: "",
    pan_no: "",
    status: 1,
};

export function getEmptyAcademy() {
    return { ...emptyAcademy };
}

// Builds a multipart FormData payload matching the /api/academies route contract.
// `logoFile` is the newly selected File (or null if the user didn't change the logo).
export function buildAcademyFormData(values, logoFile) {
    const formData = new FormData();

    formData.append("academy_name", values.academy_name.trim());
    formData.append("academy_code", values.academy_code.trim());
    formData.append("contact_person", values.contact_person.trim());
    formData.append("email", values.email.trim());
    formData.append("phone", values.phone.trim());
    formData.append("website", values.website.trim());
    formData.append("address", values.address.trim());
    formData.append("city", values.city.trim());
    formData.append("state", values.state.trim());
    formData.append("pin_code", values.pin_code.trim());
    formData.append("gst_no", values.gst_no.trim());
    formData.append("pan_no", values.pan_no.trim());
    formData.append("status", String(values.status));

    if (logoFile) {
        formData.append("logo", logoFile);
    }

    return formData;
}

export default function AcademyForm({
    formId,
    values,
    onChange,
    onSubmit,
    error,
    loading = false,
    existingLogoUrl = null,
    onLogoFileChange,
}) {
    const fileInputRef = useRef(null);
    const [logoPreview, setLogoPreview] = useState(existingLogoUrl);
    const [fieldErrors, setFieldErrors] = useState({});

    useEffect(() => {
        if (!error) return;
        if (typeof error === "object" && error.errors) {
            setFieldErrors((prev) => ({ ...prev, ...error.errors }));
        } else if (typeof error === "string") {
            const lower = error.toLowerCase();
            if (lower.includes("academy name")) setFieldErrors((prev) => ({ ...prev, academy_name: error }));
            else if (lower.includes("academy code")) setFieldErrors((prev) => ({ ...prev, academy_code: error }));
            else if (lower.includes("email")) setFieldErrors((prev) => ({ ...prev, email: error }));
            else if (lower.includes("phone")) setFieldErrors((prev) => ({ ...prev, phone: error }));
            else if (lower.includes("pin")) setFieldErrors((prev) => ({ ...prev, pin_code: error }));
        }
    }, [error]);

    const validateAll = () => {
        const errors = {};
        if (!values.academy_name?.trim()) errors.academy_name = "Academy name is required.";
        if (!values.academy_code?.trim()) errors.academy_code = "Academy code is required.";
        if (!values.contact_person?.trim()) errors.contact_person = "Contact person is required.";

        if (!values.email?.trim()) {
            errors.email = "Email is required.";
        } else if (validateEmail(values.email)) {
            errors.email = validateEmail(values.email);
        }

        if (!values.phone?.trim()) {
            errors.phone = "Phone number is required.";
        } else if (validatePhone(values.phone)) {
            errors.phone = validatePhone(values.phone);
        }

        if (!values.address?.trim()) errors.address = "Address is required.";
        if (!values.city?.trim()) errors.city = "City is required.";
        if (!values.state?.trim()) errors.state = "State is required.";
        if (values.pin_code && validatePinCode(values.pin_code)) errors.pin_code = validatePinCode(values.pin_code);

        setFieldErrors(errors);
        if (Object.keys(errors).length > 0) {
            const firstKey = Object.keys(errors)[0];
            const el = document.querySelector(`[name="${firstKey}"], #${firstKey}`);
            if (el) {
                el.focus();
                el.scrollIntoView({ behavior: "smooth", block: "center" });
            }
            return false;
        }
        return true;
    };

    const handleFormSubmit = (event) => {
        event.preventDefault();
        if (!validateAll()) return;
        if (onSubmit) onSubmit(event);
    };

    const handleChange = (field) => (event) => {
        const value = field === "status" ? Number(event.target.value) : event.target.value;
        onChange({ ...values, [field]: value });
        if (fieldErrors[field]) {
            setFieldErrors((prev) => {
                const next = { ...prev };
                delete next[field];
                return next;
            });
        }
    };

    const handleBlur = (field) => () => {
        let err = null;
        if (field === "academy_name" && !values.academy_name?.trim()) err = "Academy name is required.";
        if (field === "academy_code" && !values.academy_code?.trim()) err = "Academy code is required.";
        if (field === "contact_person" && !values.contact_person?.trim()) err = "Contact person is required.";
        if (field === "email") {
            if (!values.email?.trim()) err = "Email is required.";
            else if (validateEmail(values.email)) err = validateEmail(values.email);
        }
        if (field === "phone") {
            if (!values.phone?.trim()) err = "Phone number is required.";
            else if (validatePhone(values.phone)) err = validatePhone(values.phone);
        }
        if (field === "address" && !values.address?.trim()) err = "Address is required.";
        if (field === "city" && !values.city?.trim()) err = "City is required.";
        if (field === "state" && !values.state?.trim()) err = "State is required.";
        if (field === "pin_code" && values.pin_code) err = validatePinCode(values.pin_code);

        if (err) {
            setFieldErrors((prev) => ({ ...prev, [field]: err }));
        } else {
            setFieldErrors((prev) => {
                const next = { ...prev };
                delete next[field];
                return next;
            });
        }
    };

    const handleLogoPick = (event) => {
        const file = event.target.files?.[0] || null;
        if (file && file.size > 2 * 1024 * 1024) {
            setFieldErrors((prev) => ({ ...prev, logo: "Academy logo size must be less than 2MB" }));
            event.target.value = "";
            return;
        }
        if (fieldErrors.logo) {
            setFieldErrors((prev) => {
                const next = { ...prev };
                delete next.logo;
                return next;
            });
        }
        onLogoFileChange?.(file);

        if (file) {
            const previewUrl = URL.createObjectURL(file);
            setLogoPreview(previewUrl);
        } else {
            setLogoPreview(existingLogoUrl);
        }
    };

    const handleRemoveLogo = () => {
        onLogoFileChange?.(null);
        setLogoPreview(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    return (
        <form id={formId} onSubmit={handleFormSubmit} noValidate>
            {error && typeof error === "string" && !Object.values(fieldErrors).includes(error) && (
                <div className="alert alert-danger">{error}</div>
            )}

            <div className="row g-3">
                <div className="col-12">
                    <label className="form-label" htmlFor="logo">Academy Logo</label>
                    <div className="d-flex align-items-center gap-3">
                        <div
                            className="d-flex align-items-center justify-content-center bg-light rounded-3 border overflow-hidden flex-shrink-0"
                            style={{ width: 84, height: 84 }}
                        >
                            {logoPreview ? (
                                <img src={logoPreview} alt="Academy logo preview" className="w-100 h-100" style={{ objectFit: "cover" }} />
                            ) : (
                                <ImageIcon size={28} className="text-muted" />
                            )}
                        </div>
                        <div className="d-flex flex-column gap-2">
                            <div className="d-flex gap-2">
                                <button
                                    type="button"
                                    className="btn btn-outline-secondary btn-sm"
                                    onClick={() => fileInputRef.current?.click()}
                                    disabled={loading}
                                >
                                    <Upload size={14} className="me-1" /> {logoPreview ? "Change" : "Upload"} Logo
                                </button>
                                {logoPreview && (
                                    <button
                                        type="button"
                                        className="btn btn-outline-danger btn-sm"
                                        onClick={handleRemoveLogo}
                                        disabled={loading}
                                    >
                                        <X size={14} className="me-1" /> Remove
                                    </button>
                                )}
                            </div>
                            <small className="text-muted">JPG, PNG, WEBP or GIF. Max 2MB.</small>
                            <FormError error={fieldErrors.logo} />
                        </div>
                        <input
                            ref={fileInputRef}
                            id="logo"
                            name="logo"
                            type="file"
                            accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
                            className="d-none"
                            onChange={handleLogoPick}
                            disabled={loading}
                        />
                    </div>
                </div>

                <div className="col-md-6">
                    <label className="form-label" htmlFor="academy_name">Academy Name <span className="text-danger ms-1">*</span></label>
                    <input
                        id="academy_name"
                        name="academy_name"
                        className={`form-control ${fieldErrors.academy_name ? "is-invalid border-danger" : ""}`}
                        value={values.academy_name}
                        onChange={handleChange("academy_name")}
                        onBlur={handleBlur("academy_name")}
                        disabled={loading}
                        maxLength="50"
                    />
                    <FormError error={fieldErrors.academy_name} />
                </div>

                <div className="col-md-6">
                    <label className="form-label" htmlFor="academy_code">Academy Code <span className="text-danger ms-1">*</span></label>
                    <input
                        id="academy_code"
                        name="academy_code"
                        className={`form-control ${fieldErrors.academy_code ? "is-invalid border-danger" : ""}`}
                        value={values.academy_code}
                        onChange={handleChange("academy_code")}
                        onBlur={handleBlur("academy_code")}
                        disabled={loading}
                    />
                    <FormError error={fieldErrors.academy_code} />
                </div>

                <div className="col-md-4">
                    <label className="form-label" htmlFor="contact_person">Contact Person <span className="text-danger ms-1">*</span></label>
                    <input
                        id="contact_person"
                        name="contact_person"
                        className={`form-control ${fieldErrors.contact_person ? "is-invalid border-danger" : ""}`}
                        value={values.contact_person}
                        onChange={handleChange("contact_person")}
                        onBlur={handleBlur("contact_person")}
                        disabled={loading}
                        maxLength="50"
                    />
                    <FormError error={fieldErrors.contact_person} />
                </div>

                <div className="col-md-4">
                    <label className="form-label" htmlFor="email">Email <span className="text-danger ms-1">*</span></label>
                    <input
                        type="email"
                        id="email"
                        name="email"
                        className={`form-control ${fieldErrors.email ? "is-invalid border-danger" : ""}`}
                        value={values.email}
                        onChange={handleChange("email")}
                        onBlur={handleBlur("email")}
                        disabled={loading}
                    />
                    <FormError error={fieldErrors.email} />
                </div>

                <div className="col-md-4">
                    <label className="form-label" htmlFor="phone">Phone <span className="text-danger ms-1">*</span></label>
                    <input
                        id="phone"
                        name="phone"
                        className={`form-control ${fieldErrors.phone ? "is-invalid border-danger" : ""}`}
                        value={values.phone}
                        onChange={handleChange("phone")}
                        onBlur={handleBlur("phone")}
                        disabled={loading}
                    />
                    <FormError error={fieldErrors.phone} />
                </div>

                <div className="col-md-6">
                    <label className="form-label" htmlFor="website">Website</label>
                    <input id="website" name="website" className="form-control" placeholder="https://" value={values.website} onChange={handleChange("website")} disabled={loading} />
                </div>

                <div className="col-md-6">
                    <label className="form-label" htmlFor="pin_code">Pin Code</label>
                    <input
                        id="pin_code"
                        name="pin_code"
                        className={`form-control ${fieldErrors.pin_code ? "is-invalid border-danger" : ""}`}
                        value={values.pin_code}
                        onChange={handleChange("pin_code")}
                        onBlur={handleBlur("pin_code")}
                        disabled={loading}
                    />
                    <FormError error={fieldErrors.pin_code} />
                </div>

                <div className="col-12">
                    <label className="form-label" htmlFor="address">Address <span className="text-danger ms-1">*</span></label>
                    <textarea
                        id="address"
                        name="address"
                        className={`form-control ${fieldErrors.address ? "is-invalid border-danger" : ""}`}
                        rows={3}
                        value={values.address}
                        onChange={handleChange("address")}
                        onBlur={handleBlur("address")}
                        disabled={loading}
                    />
                    <FormError error={fieldErrors.address} />
                </div>

                <div className="col-md-6">
                    <label className="form-label" htmlFor="city">City <span className="text-danger ms-1">*</span></label>
                    <input
                        id="city"
                        name="city"
                        className={`form-control ${fieldErrors.city ? "is-invalid border-danger" : ""}`}
                        value={values.city}
                        onChange={handleChange("city")}
                        onBlur={handleBlur("city")}
                        disabled={loading}
                    />
                    <FormError error={fieldErrors.city} />
                </div>

                <div className="col-md-6">
                    <label className="form-label" htmlFor="state">State <span className="text-danger ms-1">*</span></label>
                    <input
                        id="state"
                        name="state"
                        className={`form-control ${fieldErrors.state ? "is-invalid border-danger" : ""}`}
                        value={values.state}
                        onChange={handleChange("state")}
                        onBlur={handleBlur("state")}
                        disabled={loading}
                    />
                    <FormError error={fieldErrors.state} />
                </div>

                <div className="col-md-4">
                    <label className="form-label" htmlFor="gst_no">GST No.</label>
                    <input id="gst_no" name="gst_no" className="form-control text-uppercase" value={values.gst_no} onChange={handleChange("gst_no")} disabled={loading} />
                </div>

                <div className="col-md-4">
                    <label className="form-label" htmlFor="pan_no">PAN No.</label>
                    <input id="pan_no" name="pan_no" className="form-control text-uppercase" value={values.pan_no} onChange={handleChange("pan_no")} disabled={loading} />
                </div>

                <div className="col-md-4">
                    <label className="form-label" htmlFor="status">Status</label>
                    <select id="status" name="status" className="form-select" value={values.status} onChange={handleChange("status")} disabled={loading}>
                        <option value={1}>Active</option>
                        <option value={0}>Inactive</option>
                    </select>
                </div>
            </div>
        </form>
    );
}
