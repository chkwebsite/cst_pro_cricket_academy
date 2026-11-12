"use client";

import { useRef, useState } from "react";
import { Image as ImageIcon, Upload, X } from "lucide-react";

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

    const handleChange = (field) => (event) => {
        const value = field === "status" ? Number(event.target.value) : event.target.value;
        onChange({ ...values, [field]: value });
    };

    const handleLogoPick = (event) => {
        const file = event.target.files?.[0] || null;
        if (file && file.size > 2 * 1024 * 1024) {
            alert("Academy logo size must be less than 2MB");
            event.target.value = "";
            return;
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
        <form id={formId} onSubmit={onSubmit}>
            {error && <div className="alert alert-danger">{error}</div>}

            <div className="row g-3">
                <div className="col-12">
                    <label className="form-label">Academy Logo</label>
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
                        </div>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
                            className="d-none"
                            onChange={handleLogoPick}
                            disabled={loading}
                        />
                    </div>
                </div>

                <div className="col-md-6">
                    <label className="form-label">Academy Name</label>
                    <input
                        className="form-control"
                        value={values.academy_name}
                        onChange={handleChange("academy_name")}
                        required
                        disabled={loading}
                    />
                </div>

                <div className="col-md-6">
                    <label className="form-label">Academy Code</label>
                    <input
                        className="form-control"
                        value={values.academy_code}
                        onChange={handleChange("academy_code")}
                        required
                        disabled={loading}
                    />
                </div>

                <div className="col-md-4">
                    <label className="form-label">Contact Person</label>
                    <input className="form-control" value={values.contact_person} onChange={handleChange("contact_person")} disabled={loading} />
                </div>

                <div className="col-md-4">
                    <label className="form-label">Email</label>
                    <input type="email" className="form-control" value={values.email} onChange={handleChange("email")} disabled={loading} />
                </div>

                <div className="col-md-4">
                    <label className="form-label">Phone</label>
                    <input className="form-control" value={values.phone} onChange={handleChange("phone")} disabled={loading} />
                </div>

                <div className="col-md-6">
                    <label className="form-label">Website</label>
                    <input className="form-control" placeholder="https://" value={values.website} onChange={handleChange("website")} disabled={loading} />
                </div>

                <div className="col-md-6">
                    <label className="form-label">Pin Code</label>
                    <input className="form-control" value={values.pin_code} onChange={handleChange("pin_code")} disabled={loading} />
                </div>

                <div className="col-12">
                    <label className="form-label">Address</label>
                    <textarea className="form-control" rows={3} value={values.address} onChange={handleChange("address")} disabled={loading} />
                </div>

                <div className="col-md-6">
                    <label className="form-label">City</label>
                    <input className="form-control" value={values.city} onChange={handleChange("city")} disabled={loading} />
                </div>

                <div className="col-md-6">
                    <label className="form-label">State</label>
                    <input className="form-control" value={values.state} onChange={handleChange("state")} disabled={loading} />
                </div>

                <div className="col-md-4">
                    <label className="form-label">GST No.</label>
                    <input className="form-control text-uppercase" value={values.gst_no} onChange={handleChange("gst_no")} disabled={loading} />
                </div>

                <div className="col-md-4">
                    <label className="form-label">PAN No.</label>
                    <input className="form-control text-uppercase" value={values.pan_no} onChange={handleChange("pan_no")} disabled={loading} />
                </div>

                <div className="col-md-4">
                    <label className="form-label">Status</label>
                    <select className="form-select" value={values.status} onChange={handleChange("status")} disabled={loading}>
                        <option value={1}>Active</option>
                        <option value={0}>Inactive</option>
                    </select>
                </div>
            </div>
        </form>
    );
}
