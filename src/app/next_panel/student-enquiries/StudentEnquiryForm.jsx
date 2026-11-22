"use client";

import { ArrowLeft, RefreshCw, Save } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ENQUIRY_SOURCES, ENQUIRY_STATUSES } from "./enquiryHelpers";
import { FormError, RequiredLabel } from "@/app/components/form";

const EMPTY_FORM = {
    academy_id: 1,
    branch_id: "",
    student_name: "",
    age: "",
    phone: "",
    email: "",
    program_id: "",
    message: "",
    enquiry_source: "Walk-in",
    enquiry_status: "New",
    assigned_to: "",
};

export default function StudentEnquiryForm({ id = null, returnTo = "/next_panel/student-enquiries" }) {
    const router = useRouter();
    const isEdit = Boolean(id);

    const [formData, setFormData] = useState(EMPTY_FORM);
    const [academies, setAcademies] = useState([]);
    const [branches, setBranches] = useState([]);
    const [programs, setPrograms] = useState([]);
    const [staffUsers, setStaffUsers] = useState([]);

    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(isEdit);
    const [error, setError] = useState("");
    const [fieldErrors, setFieldErrors] = useState({});
    const [successMsg, setSuccessMsg] = useState("");

    // Load master options (academies, branches, programs, staff)
    useEffect(() => {
        (async () => {
            try {
                const [aRes, bRes, pRes, uRes] = await Promise.all([
                    fetch("/api/academies"),
                    fetch("/api/branch"),
                    fetch("/api/programs"),
                    fetch("/api/users?status=1"),
                ]);

                const aJson = await aRes.json();
                const bJson = await bRes.json();
                const pJson = await pRes.json();
                const uJson = await uRes.json();

                if (aRes.ok && aJson.success) setAcademies(aJson.data || []);
                if (bRes.ok && bJson.success) setBranches(bJson.data || []);
                if (pRes.ok && pJson.success) setPrograms(pJson.data || []);
                if (uRes.ok && uJson.success) setStaffUsers(uJson.data || []);
            } catch {
                /* non-fatal */
            }
        })();
    }, []);

    // Load existing enquiry if in edit mode
    useEffect(() => {
        if (!isEdit) return;
        const controller = new AbortController();
        (async () => {
            setFetching(true);
            setError("");
            try {
                const res = await fetch(`/api/student-enquiries/${id}`, { signal: controller.signal });
                const json = await res.json();
                if (!res.ok || !json.success) {
                    throw new Error(json.message || "Failed to load student enquiry");
                }
                const d = json.data;
                setFormData({
                    academy_id: d.academy_id ? Number(d.academy_id) : 1,
                    branch_id: d.branch_id ? String(d.branch_id) : "",
                    student_name: d.student_name || "",
                    age: d.age !== null && d.age !== undefined ? String(d.age) : "",
                    phone: d.phone || "",
                    email: d.email || "",
                    program_id: d.program_id ? String(d.program_id) : "",
                    message: d.message || "",
                    enquiry_source: d.enquiry_source || "Other",
                    enquiry_status: d.enquiry_status || "New",
                    assigned_to: d.assigned_to ? String(d.assigned_to) : "",
                });
            } catch (err) {
                if (err.name !== "AbortError") setError(err.message);
            } finally {
                if (!controller.signal.aborted) setFetching(false);
            }
        })();
        return () => controller.abort();
    }, [id, isEdit]);

    // Branches filtered by selected academy_id
    const filteredBranches = branches.filter(
        (b) => !formData.academy_id || Number(b.academy_id) === Number(formData.academy_id)
    );

    const handleChange = (e) => {
        const { name, value } = e.target;
        if (fieldErrors[name]) {
            setFieldErrors((prev) => {
                const next = { ...prev };
                delete next[name];
                return next;
            });
        }
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const handleBlur = (e) => {
        const { name, value } = e.target;
        if (name === "student_name" && !value?.trim()) {
            setFieldErrors((prev) => ({ ...prev, student_name: "Student name is required." }));
        }
        if (name === "phone") {
            if (!value?.trim()) {
                setFieldErrors((prev) => ({ ...prev, phone: "Phone number is required." }));
            } else if (!/^[0-9+\s\-()]{7,20}$/.test(value.trim())) {
                setFieldErrors((prev) => ({ ...prev, phone: "Please enter a valid phone number." }));
            }
        }
        if (name === "email" && value?.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) {
            setFieldErrors((prev) => ({ ...prev, email: "Please enter a valid email address." }));
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");
        setSuccessMsg("");

        const errs = {};
        if (!formData.student_name?.trim()) {
            errs.student_name = "Student name is required.";
        }
        if (!formData.phone?.trim()) {
            errs.phone = "Phone number is required.";
        } else if (!/^[0-9+\s\-()]{7,20}$/.test(formData.phone.trim())) {
            errs.phone = "Please enter a valid phone number.";
        }
        if (formData.email?.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
            errs.email = "Please enter a valid email address.";
        }

        if (Object.keys(errs).length > 0) {
            setFieldErrors(errs);
            const firstKey = Object.keys(errs)[0];
            const el = document.querySelector(`[name="${firstKey}"]`);
            if (el) {
                el.focus();
                el.scrollIntoView({ behavior: "smooth", block: "center" });
            }
            return;
        }

        const payload = {
            academy_id: formData.academy_id ? Number(formData.academy_id) : null,
            branch_id: formData.branch_id ? Number(formData.branch_id) : null,
            student_name: formData.student_name.trim(),
            age: formData.age !== "" && formData.age !== null ? Number(formData.age) : null,
            phone: formData.phone.trim(),
            email: formData.email.trim() || null,
            program_id: formData.program_id ? Number(formData.program_id) : null,
            message: formData.message.trim() || null,
            enquiry_source: formData.enquiry_source,
            enquiry_status: formData.enquiry_status,
            assigned_to: formData.assigned_to ? Number(formData.assigned_to) : null,
        };

        setLoading(true);
        try {
            const url = isEdit ? `/api/student-enquiries/${id}` : "/api/student-enquiries";
            const method = isEdit ? "PUT" : "POST";

            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            const json = await res.json();
            if (!res.ok || !json.success) {
                if (json.errors) {
                    setFieldErrors(json.errors);
                    const firstKey = Object.keys(json.errors)[0];
                    const el = document.querySelector(`[name="${firstKey}"]`);
                    if (el) {
                        el.focus();
                        el.scrollIntoView({ behavior: "smooth", block: "center" });
                    }
                }
                throw new Error(json.message || "Failed to save student enquiry");
            }

            setSuccessMsg(isEdit ? "Enquiry updated successfully!" : "Enquiry created successfully!");
            setTimeout(() => {
                router.push(returnTo);
            }, 700);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    if (fetching) {
        return (
            <div className="text-center py-5">
                <RefreshCw className="spinner-border spinner-border-sm me-2" /> Loading enquiry data...
            </div>
        );
    }

    return (
        <form onSubmit={handleSubmit} noValidate>
            {error && <div className="alert alert-danger">{error}</div>}
            {successMsg && <div className="alert alert-success">{successMsg}</div>}

            <div className="row g-3">
                {/* Student Name */}
                <div className="col-md-6">
                    <label className="form-label fw-semibold">
                        Student Name <span style={{ color: "#dc3545" }}>*</span>
                    </label>
                    <input
                        type="text"
                        name="student_name"
                        className={`form-control ${fieldErrors.student_name ? "is-invalid border-danger" : ""}`}
                        placeholder="e.g. Aarav Mehta"
                        value={formData.student_name}
                        onChange={handleChange}
                        onBlur={handleBlur}
                    />
                    <FormError error={fieldErrors.student_name} />
                </div>

                {/* Age */}
                <div className="col-md-3">
                    <label className="form-label fw-semibold">Age</label>
                    <input
                        type="number"
                        name="age"
                        className="form-control"
                        min="3"
                        max="80"
                        placeholder="e.g. 14"
                        value={formData.age}
                        onChange={handleChange}
                    />
                </div>

                {/* Source */}
                <div className="col-md-3">
                    <label className="form-label fw-semibold">Enquiry Source</label>
                    <select
                        name="enquiry_source"
                        className="form-select"
                        value={formData.enquiry_source}
                        onChange={handleChange}
                    >
                        {ENQUIRY_SOURCES.map((src) => (
                            <option key={src} value={src}>
                                {src}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Phone */}
                <div className="col-md-6">
                    <label className="form-label fw-semibold">
                        Phone Number <span style={{ color: "#dc3545" }}>*</span>
                    </label>
                    <input
                        type="tel"
                        name="phone"
                        className={`form-control ${fieldErrors.phone ? "is-invalid border-danger" : ""}`}
                        placeholder="e.g. +91 9876543210"
                        value={formData.phone}
                        onChange={handleChange}
                        onBlur={handleBlur}
                    />
                    <FormError error={fieldErrors.phone} />
                </div>

                {/* Email */}
                <div className="col-md-6">
                    <label className="form-label fw-semibold">Email Address</label>
                    <input
                        type="email"
                        name="email"
                        className={`form-control ${fieldErrors.email ? "is-invalid border-danger" : ""}`}
                        placeholder="e.g. parent@example.com"
                        value={formData.email}
                        onChange={handleChange}
                        onBlur={handleBlur}
                    />
                    <FormError error={fieldErrors.email} />
                </div>

                {/* Academy & Branch */}
                <div className="col-md-6">
                    <label className="form-label fw-semibold">Academy</label>
                    <select
                        name="academy_id"
                        className="form-select"
                        value={formData.academy_id}
                        onChange={handleChange}
                    >
                        {academies.map((a) => (
                            <option key={a.id} value={a.id}>
                                {a.academy_name || a.name || `Academy #${a.id}`}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="col-md-6">
                    <label className="form-label fw-semibold">Branch</label>
                    <select
                        name="branch_id"
                        className="form-select"
                        value={formData.branch_id}
                        onChange={handleChange}
                    >
                        <option value="">Select Branch</option>
                        {filteredBranches.map((b) => (
                            <option key={b.id} value={b.id}>
                                {b.branch_name} {b.city ? `(${b.city})` : ""}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Program & Status */}
                <div className="col-md-6">
                    <label className="form-label fw-semibold">Program</label>
                    <select
                        name="program_id"
                        className="form-select"
                        value={formData.program_id}
                        onChange={handleChange}
                    >
                        <option value="">Select Program</option>
                        {programs.map((p) => (
                            <option key={p.id} value={p.id}>
                                {p.program_name}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="col-md-6">
                    <label className="form-label fw-semibold">Enquiry Status</label>
                    <select
                        name="enquiry_status"
                        className="form-select"
                        value={formData.enquiry_status}
                        onChange={handleChange}
                    >
                        {ENQUIRY_STATUSES.map((st) => (
                            <option key={st} value={st}>
                                {st}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Assigned Staff */}
                <div className="col-md-12">
                    <label className="form-label fw-semibold">Assigned Staff / Coach</label>
                    <select
                        name="assigned_to"
                        className="form-select"
                        value={formData.assigned_to}
                        onChange={handleChange}
                    >
                        <option value="">Unassigned</option>
                        {staffUsers.map((u) => (
                            <option key={u.id} value={u.id}>
                                {u.first_name} {u.last_name} ({u.email || u.phone})
                            </option>
                        ))}
                    </select>
                </div>

                {/* Questions / Message */}
                <div className="col-12">
                    <label className="form-label fw-semibold">Message / Notes</label>
                    <textarea
                        name="message"
                        rows={4}
                        className="form-control"
                        placeholder="Inquiry notes, batch timings requested, trial scheduling details..."
                        value={formData.message}
                        onChange={handleChange}
                    ></textarea>
                </div>

                {/* Form Buttons */}
                <div className="col-12 d-flex justify-content-end gap-2 mt-4">
                    <Link href={returnTo} className="btn btn-outline-secondary px-4">
                        Cancel
                    </Link>
                    <button type="submit" className="btn btn-primary px-4" disabled={loading}>
                        {loading ? (
                            <>
                                <RefreshCw className="spinner-border spinner-border-sm me-2" />
                                Saving...
                            </>
                        ) : (
                            <>
                                <Save size={16} className="me-2" />
                                {isEdit ? "Update Enquiry" : "Create Enquiry"}
                            </>
                        )}
                    </button>
                </div>
            </div>
        </form>
    );
}
