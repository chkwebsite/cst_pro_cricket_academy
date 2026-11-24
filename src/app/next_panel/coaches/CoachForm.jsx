"use client";

import { ArrowLeft, CheckCircle2, Save } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useUser } from "../components/UserContext";
import { FormError, RequiredLabel, validatePhone } from "@/app/components/form";

const SPECIALIZATION_OPTIONS = [
    "Batting",
    "Bowling",
    "Fielding",
    "Wicket Keeping",
    "Fitness",
    "All Rounder",
];

const EMPLOYMENT_TYPES = ["Full Time", "Part Time", "Visiting", "Contract"];

const EMPTY_FORM = {
    user_id: "",
    academy_id: "",
    branch_id: "",
    coach_code: "",
    date_of_birth: "",
    gender: "Male",
    qualification: "",
    specialization: ["All Rounder"],
    experience_years: 0,
    certifications: "",
    previous_academy: "",
    employment_type: "Full Time",
    joining_date: "",
    salary: "",
    emergency_contact_name: "",
    emergency_contact_phone: "",
    bio: "",
    status: 1,
};

export default function CoachForm({ id = null }) {
    const router = useRouter();
    const { user } = useUser();
    const isEdit = Boolean(id);

    const [formData, setFormData] = useState(EMPTY_FORM);
    const [coachesUsers, setCoachesUsers] = useState([]);
    const [academies, setAcademies] = useState([]);
    const [branches, setBranches] = useState([]);

    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(false);
    const [optionsLoading, setOptionsLoading] = useState(true);
    const [error, setError] = useState("");
    const [fieldErrors, setFieldErrors] = useState({});
    const [successNotice, setSuccessNotice] = useState("");

    const hasSessionUser = Boolean(user);
    const userAcademyId = user?.academy_id;
    const userBranchId = user?.branch_id;
    const isAcademyAdmin = user?.user_type === "Academy Admin";
    const hasAssignedAcademy =
        userAcademyId !== null &&
        userAcademyId !== undefined &&
        userAcademyId !== "" &&
        Number(userAcademyId) > 0;
    const hasAssignedBranch =
        userBranchId !== null &&
        userBranchId !== undefined &&
        userBranchId !== "" &&
        Number(userBranchId) > 0;
    const isBranchRestricted = hasAssignedAcademy && !isAcademyAdmin;

    // Load initial options (academies, branches, users)
    useEffect(() => {
        if (!hasSessionUser) return;

        const loadOptions = async () => {
            setOptionsLoading(true);
            try {
                const branchUrl = hasAssignedAcademy
                    ? `/api/branch?academy_id=${userAcademyId}`
                    : "/api/branch";

                const [acadRes, branchRes, usersRes] = await Promise.all([
                    fetch("/api/academies"),
                    fetch(branchUrl),
                    fetch("/api/users"),
                ]);

                const acadJson = await acadRes.json();
                const branchJson = await branchRes.json();
                const usersJson = await usersRes.json();

                if (acadRes.ok && acadJson.success) {
                    const list = acadJson.data || [];
                    setAcademies(
                        hasAssignedAcademy
                            ? list.filter((a) => Number(a.id) === Number(userAcademyId))
                            : list
                    );
                }

                if (branchRes.ok && branchJson.success) {
                    setBranches(branchJson.data || []);
                }

                if (usersRes.ok && usersJson.success) {
                    setCoachesUsers(usersJson.data || []);
                }

                if (!isEdit && hasAssignedAcademy) {
                    setFormData((prev) => ({
                        ...prev,
                        academy_id: Number(userAcademyId),
                        branch_id:
                            isBranchRestricted && hasAssignedBranch
                                ? Number(userBranchId)
                                : prev.branch_id,
                    }));
                }
            } catch (err) {
                setError(err.message || "Failed to load options");
            } finally {
                setOptionsLoading(false);
            }
        };

        loadOptions();
    }, [hasSessionUser, hasAssignedAcademy, userAcademyId, isBranchRestricted, hasAssignedBranch, userBranchId, isEdit]);

    // Load existing coach profile in edit mode
    useEffect(() => {
        if (!id) return;

        const fetchCoach = async () => {
            setFetching(true);
            setError("");
            try {
                const res = await fetch(`/api/coaches/${id}`);
                const json = await res.json();
                if (!res.ok || !json.success) {
                    throw new Error(json.message || "Failed to fetch coach details");
                }
                const d = json.data;
                const specs = d.specialization
                    ? d.specialization.split(",").map((s) => s.trim()).filter(Boolean)
                    : [];

                setFormData({
                    user_id: d.user_id || "",
                    academy_id: d.academy_id || "",
                    branch_id: d.branch_id || "",
                    coach_code: d.coach_code || "",
                    date_of_birth: d.date_of_birth ? String(d.date_of_birth).slice(0, 10) : "",
                    gender: d.gender || "Male",
                    qualification: d.qualification || "",
                    specialization: specs.length > 0 ? specs : ["All Rounder"],
                    experience_years: d.experience_years !== null ? Number(d.experience_years) : 0,
                    certifications: d.certifications || "",
                    previous_academy: d.previous_academy || "",
                    employment_type: d.employment_type || "Full Time",
                    joining_date: d.joining_date ? String(d.joining_date).slice(0, 10) : "",
                    salary: d.salary !== null ? d.salary : "",
                    emergency_contact_name: d.emergency_contact_name || "",
                    emergency_contact_phone: d.emergency_contact_phone || "",
                    bio: d.bio || "",
                    status: d.status !== undefined ? Number(d.status) : 1,
                    coach_name: d.coach_name || "",
                });
            } catch (err) {
                setError(err.message);
            } finally {
                setFetching(false);
            }
        };

        fetchCoach();
    }, [id]);

    const handleInputChange = (e) => {
        const { name, value } = e.target;

        if (fieldErrors[name]) {
            setFieldErrors((prev) => {
                const next = { ...prev };
                delete next[name];
                return next;
            });
        }

        if (name === "academy_id") {
            const newAcadId = value === "" ? "" : Number(value);
            setFormData((prev) => {
                const validBranch = branches.some(
                    (b) =>
                        Number(b.id) === Number(prev.branch_id) &&
                        Number(b.academy_id) === Number(newAcadId)
                );
                return {
                    ...prev,
                    academy_id: newAcadId,
                    branch_id: validBranch ? prev.branch_id : "",
                };
            });
            return;
        }

        if (["branch_id", "status"].includes(name)) {
            setFormData((prev) => ({
                ...prev,
                [name]: value === "" ? "" : Number(value),
            }));
            return;
        }

        setFormData((prev) => ({
            ...prev,
            [name]: value,
        }));
    };

    const handleBlur = (field) => () => {
        let err = null;
        if (field === "user_id" && !isEdit && !formData.user_id) err = "Please select a user account.";
        if (field === "coach_code" && !formData.coach_code?.trim()) err = "Coach code is required.";
        if (field === "academy_id" && !formData.academy_id) err = "Please select an academy.";
        if (field === "branch_id" && !formData.branch_id) err = "Please select a branch.";
        if (field === "gender" && !formData.gender) err = "Please select gender.";
        if (field === "experience_years" && formData.experience_years !== "" && (isNaN(Number(formData.experience_years)) || Number(formData.experience_years) < 0)) {
            err = "Experience years must be a valid non-negative number.";
        }
        if (field === "salary" && formData.salary !== "" && formData.salary !== null && (isNaN(Number(formData.salary)) || Number(formData.salary) < 0)) {
            err = "Salary must be a valid non-negative number.";
        }
        if (field === "emergency_contact_phone" && formData.emergency_contact_phone?.trim()) {
            err = validatePhone(formData.emergency_contact_phone, "Emergency contact phone");
        }

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

    const validateAll = () => {
        const errors = {};
        if (!isEdit && !formData.user_id) errors.user_id = "Please select a user account for this coach profile.";
        if (!formData.coach_code?.trim()) errors.coach_code = "Coach code is required.";
        if (!formData.academy_id) errors.academy_id = "Please select an academy.";
        if (!formData.branch_id) errors.branch_id = "Please select a branch.";
        if (!formData.specialization || formData.specialization.length === 0) {
            errors.specialization = "Please select at least one specialization.";
        }
        if (!formData.gender) errors.gender = "Please select gender.";
        if (formData.experience_years !== "" && (isNaN(Number(formData.experience_years)) || Number(formData.experience_years) < 0)) {
            errors.experience_years = "Experience years must be a valid non-negative number.";
        }
        if (formData.salary !== "" && formData.salary !== null && (isNaN(Number(formData.salary)) || Number(formData.salary) < 0)) {
            errors.salary = "Salary must be a valid non-negative number.";
        }
        if (formData.emergency_contact_phone?.trim()) {
            const phoneErr = validatePhone(formData.emergency_contact_phone, "Emergency contact phone");
            if (phoneErr) errors.emergency_contact_phone = phoneErr;
        }

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

    const handleSpecializationToggle = (spec) => {
        if (fieldErrors.specialization) {
            setFieldErrors((prev) => {
                const next = { ...prev };
                delete next.specialization;
                return next;
            });
        }
        setFormData((prev) => {
            const current = prev.specialization || [];
            if (current.includes(spec)) {
                const filtered = current.filter((s) => s !== spec);
                return {
                    ...prev,
                    specialization: filtered.length > 0 ? filtered : ["All Rounder"],
                };
            } else {
                return {
                    ...prev,
                    specialization: [...current, spec],
                };
            }
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!validateAll()) return;

        setLoading(true);
        setError("");
        setSuccessNotice("");

        try {
            const payload = {
                ...formData,
                user_id: formData.user_id ? Number(formData.user_id) : null,
                academy_id: formData.academy_id ? Number(formData.academy_id) : null,
                branch_id: formData.branch_id ? Number(formData.branch_id) : null,
                experience_years: Number(formData.experience_years || 0),
                salary: formData.salary === "" ? null : Number(formData.salary),
                date_of_birth: formData.date_of_birth || null,
                joining_date: formData.joining_date || null,
                specialization: formData.specialization,
                status: Number(formData.status),
            };

            const url = isEdit ? `/api/coaches/${id}` : "/api/coaches";
            const method = isEdit ? "PUT" : "POST";

            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            const json = await res.json();
            if (!res.ok || !json.success) {
                if (json.errors) {
                    setFieldErrors((prev) => ({ ...prev, ...json.errors }));
                    const firstKey = Object.keys(json.errors)[0];
                    const el = document.querySelector(`[name="${firstKey}"], #${firstKey}`);
                    if (el) {
                        el.focus();
                        el.scrollIntoView({ behavior: "smooth", block: "center" });
                    }
                }
                throw new Error(json.message || "Failed to save coach profile");
            }

            setSuccessNotice(isEdit ? "Coach updated successfully!" : "Coach created successfully!");
            setTimeout(() => {
                router.push("/next_panel/coaches");
                router.refresh();
            }, 1000);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    if (fetching || optionsLoading) {
        return (
            <div className="card border-0 shadow-sm rounded-4 p-5 text-center text-muted">
                <div className="spinner-border spinner-border-sm text-primary me-2" role="status"></div>
                Loading coach details...
            </div>
        );
    }

    return (
        <form onSubmit={handleSubmit}>
            <div className="card border-0 shadow-sm rounded-4 mb-4">
                <div className="card-header bg-white border-bottom py-3 px-4 d-flex justify-content-between align-items-center">
                    <div>
                        <h5 className="fw-bold mb-0">
                            {isEdit ? "Edit Coach Profile" : "Add New Coach Profile"}
                        </h5>
                        <p className="text-muted small mb-0">
                            Configure coach credentials, qualifications, and biography for the panel and website.
                        </p>
                    </div>
                    <Link
                        href="/next_panel/coaches"
                        className="btn btn-outline-secondary btn-sm d-flex align-items-center gap-1"
                    >
                        <ArrowLeft size={16} /> Back
                    </Link>
                </div>

                <div className="card-body p-4">
                    {error && (
                        <div className="alert alert-danger alert-dismissible fade show mb-4" role="alert">
                            {error}
                            <button
                                type="button"
                                className="btn-close"
                                onClick={() => setError("")}
                            ></button>
                        </div>
                    )}

                    {successNotice && (
                        <div className="alert alert-success alert-dismissible fade show mb-4" role="alert">
                            <CheckCircle2 size={16} className="me-2" />
                            {successNotice}
                        </div>
                    )}

                    {/* Section 1: User Account & Basic Mapping */}
                    <div className="mb-4">
                        <h6 className="fw-bold text-uppercase small text-primary mb-3">
                            1. Linked User Account & Academy
                        </h6>
                        <div className="row g-3">
                            <div className="col-md-6">
                                <label className="form-label fw-semibold" htmlFor="user_id">
                                    Linked User Account {!isEdit && <span className="text-danger">*</span>}
                                </label>
                                {isEdit ? (
                                    <input
                                        id="user_id"
                                        type="text"
                                        className="form-control bg-light"
                                        value={formData.coach_name || `User ID: ${formData.user_id}`}
                                        disabled
                                        readOnly
                                    />
                                ) : (
                                    <select
                                        id="user_id"
                                        name="user_id"
                                        className={`form-select ${fieldErrors.user_id ? "is-invalid border-danger" : ""}`}
                                        value={formData.user_id}
                                        onChange={handleInputChange}
                                        onBlur={handleBlur("user_id")}
                                    >
                                        <option value="">Select User Account...</option>
                                        {coachesUsers.map((u) => (
                                            <option key={u.id} value={u.id}>
                                                {u.first_name} {u.last_name} ({u.user_type || "User"}{" "}
                                                {u.email ? `• ${u.email}` : ""})
                                            </option>
                                        ))}
                                    </select>
                                )}
                                <FormError error={fieldErrors.user_id} />
                                <div className="form-text">
                                    Coach profile is mapped to this user account in CST Crickinfo.
                                </div>
                            </div>

                            <div className="col-md-6">
                                <label className="form-label fw-semibold" htmlFor="coach_code">
                                    Coach Code <span className="text-danger">*</span>
                                </label>
                                <input
                                    id="coach_code"
                                    type="text"
                                    name="coach_code"
                                    className={`form-control ${fieldErrors.coach_code ? "is-invalid border-danger" : ""}`}
                                    placeholder="e.g. CCH-001 or STF-2026-0004"
                                    value={formData.coach_code}
                                    onChange={handleInputChange}
                                    onBlur={handleBlur("coach_code")}
                                />
                                <FormError error={fieldErrors.coach_code} />
                                <div className="form-text">Unique identification code for this coach.</div>
                            </div>

                            <div className="col-md-6">
                                <label className="form-label fw-semibold" htmlFor="academy_id">
                                    Academy <span className="text-danger">*</span>
                                </label>
                                <select
                                    id="academy_id"
                                    name="academy_id"
                                    className={`form-select ${fieldErrors.academy_id ? "is-invalid border-danger" : ""}`}
                                    value={formData.academy_id}
                                    onChange={handleInputChange}
                                    onBlur={handleBlur("academy_id")}
                                    disabled={hasAssignedAcademy && !isAcademyAdmin}
                                >
                                    <option value="">Select Academy...</option>
                                    {academies.map((a) => (
                                        <option key={a.id} value={a.id}>
                                            {a.academy_name}
                                        </option>
                                    ))}
                                </select>
                                <FormError error={fieldErrors.academy_id} />
                            </div>

                            <div className="col-md-6">
                                <label className="form-label fw-semibold" htmlFor="branch_id">
                                    Branch <span className="text-danger">*</span>
                                </label>
                                <select
                                    id="branch_id"
                                    name="branch_id"
                                    className={`form-select ${fieldErrors.branch_id ? "is-invalid border-danger" : ""}`}
                                    value={formData.branch_id}
                                    onChange={handleInputChange}
                                    onBlur={handleBlur("branch_id")}
                                    disabled={isBranchRestricted && hasAssignedBranch}
                                >
                                    <option value="">Select Branch...</option>
                                    {branches
                                        .filter(
                                            (b) =>
                                                !formData.academy_id ||
                                                Number(b.academy_id) === Number(formData.academy_id)
                                        )
                                        .map((b) => (
                                            <option key={b.id} value={b.id}>
                                                {b.branch_name}
                                            </option>
                                        ))}
                                </select>
                                <FormError error={fieldErrors.branch_id} />
                            </div>
                        </div>
                    </div>

                    <hr className="my-4 text-muted opacity-25" />

                    {/* Section 2: Specialization & Cricket Expertise */}
                    <div className="mb-4">
                        <h6 className="fw-bold text-uppercase small text-primary mb-3">
                            2. Specializations & Cricket Qualifications
                        </h6>
                        <div className="mb-3">
                            <label className="form-label fw-semibold d-block">
                                Specialization <span className="text-danger">*</span>
                            </label>
                            <div className="d-flex flex-wrap gap-2">
                                {SPECIALIZATION_OPTIONS.map((spec) => {
                                    const selected = formData.specialization?.includes(spec);
                                    return (
                                        <button
                                            key={spec}
                                            type="button"
                                            className={`btn btn-sm rounded-pill px-3 py-1.5 transition-all ${
                                                selected
                                                    ? "btn-primary shadow-sm"
                                                    : "btn-outline-secondary"
                                            }`}
                                            onClick={() => handleSpecializationToggle(spec)}
                                        >
                                            {selected && "✓ "}
                                            {spec}
                                        </button>
                                    );
                                })}
                            </div>
                            <FormError error={fieldErrors.specialization} />
                            <div className="form-text mt-1">
                                Select one or multiple areas of coaching expertise.
                            </div>
                        </div>

                        <div className="row g-3">
                            <div className="col-md-4">
                                <label className="form-label fw-semibold" htmlFor="experience_years">Experience (Years)</label>
                                <input
                                    id="experience_years"
                                    type="number"
                                    step="0.5"
                                    min="0"
                                    max="99"
                                    name="experience_years"
                                    className={`form-control ${fieldErrors.experience_years ? "is-invalid border-danger" : ""}`}
                                    value={formData.experience_years}
                                    onChange={handleInputChange}
                                    onBlur={handleBlur("experience_years")}
                                />
                                <FormError error={fieldErrors.experience_years} />
                            </div>

                            <div className="col-md-4">
                                <label className="form-label fw-semibold" htmlFor="qualification">Educational / Cricket Qualification</label>
                                <input
                                    id="qualification"
                                    type="text"
                                    name="qualification"
                                    className="form-control"
                                    placeholder="e.g. BCCI Level 2, NIS Certified"
                                    value={formData.qualification}
                                    onChange={handleInputChange}
                                />
                            </div>

                            <div className="col-md-4">
                                <label className="form-label fw-semibold" htmlFor="previous_academy">Previous Academy / Club</label>
                                <input
                                    id="previous_academy"
                                    type="text"
                                    name="previous_academy"
                                    className="form-control"
                                    placeholder="e.g. National Cricket Academy"
                                    value={formData.previous_academy}
                                    onChange={handleInputChange}
                                />
                            </div>

                            <div className="col-12">
                                <label className="form-label fw-semibold" htmlFor="certifications">Certifications & Accreditations</label>
                                <textarea
                                    id="certifications"
                                    name="certifications"
                                    className="form-control"
                                    rows={2}
                                    placeholder="List certifications (e.g. ICC Level 1, First Aid Certified, Strength & Conditioning)..."
                                    value={formData.certifications}
                                    onChange={handleInputChange}
                                />
                            </div>
                        </div>
                    </div>

                    <hr className="my-4 text-muted opacity-25" />

                    {/* Section 3: Employment Details & Personal Info */}
                    <div className="mb-4">
                        <h6 className="fw-bold text-uppercase small text-primary mb-3">
                            3. Employment & Personal Details
                        </h6>
                        <div className="row g-3">
                            <div className="col-md-3">
                                <label className="form-label fw-semibold" htmlFor="employment_type">Employment Type</label>
                                <select
                                    id="employment_type"
                                    name="employment_type"
                                    className="form-select"
                                    value={formData.employment_type}
                                    onChange={handleInputChange}
                                >
                                    {EMPLOYMENT_TYPES.map((t) => (
                                        <option key={t} value={t}>
                                            {t}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="col-md-3">
                                <label className="form-label fw-semibold" htmlFor="gender">
                                    Gender <span className="text-danger">*</span>
                                </label>
                                <select
                                    id="gender"
                                    name="gender"
                                    className={`form-select ${fieldErrors.gender ? "is-invalid border-danger" : ""}`}
                                    value={formData.gender}
                                    onChange={handleInputChange}
                                    onBlur={handleBlur("gender")}
                                >
                                    <option value="Male">Male</option>
                                    <option value="Female">Female</option>
                                    <option value="Other">Other</option>
                                </select>
                                <FormError error={fieldErrors.gender} />
                            </div>

                            <div className="col-md-3">
                                <label className="form-label fw-semibold" htmlFor="date_of_birth">Date of Birth</label>
                                <input
                                    id="date_of_birth"
                                    type="date"
                                    name="date_of_birth"
                                    className="form-control"
                                    value={formData.date_of_birth}
                                    onChange={handleInputChange}
                                />
                            </div>

                            <div className="col-md-3">
                                <label className="form-label fw-semibold" htmlFor="joining_date">Joining Date</label>
                                <input
                                    id="joining_date"
                                    type="date"
                                    name="joining_date"
                                    className="form-control"
                                    value={formData.joining_date}
                                    onChange={handleInputChange}
                                />
                            </div>

                            <div className="col-md-4">
                                <label className="form-label fw-semibold" htmlFor="salary">Monthly Salary (₹)</label>
                                <input
                                    id="salary"
                                    type="number"
                                    step="100"
                                    name="salary"
                                    className={`form-control ${fieldErrors.salary ? "is-invalid border-danger" : ""}`}
                                    placeholder="e.g. 25000"
                                    value={formData.salary}
                                    onChange={handleInputChange}
                                    onBlur={handleBlur("salary")}
                                />
                                <FormError error={fieldErrors.salary} />
                            </div>

                            <div className="col-md-4">
                                <label className="form-label fw-semibold" htmlFor="emergency_contact_name">Emergency Contact Name</label>
                                <input
                                    id="emergency_contact_name"
                                    type="text"
                                    name="emergency_contact_name"
                                    className="form-control"
                                    placeholder="e.g. Next of Kin"
                                    value={formData.emergency_contact_name}
                                    onChange={handleInputChange}
                                />
                            </div>

                            <div className="col-md-4">
                                <label className="form-label fw-semibold" htmlFor="emergency_contact_phone">Emergency Contact Phone</label>
                                <input
                                    id="emergency_contact_phone"
                                    type="tel"
                                    name="emergency_contact_phone"
                                    className={`form-control ${fieldErrors.emergency_contact_phone ? "is-invalid border-danger" : ""}`}
                                    placeholder="e.g. +91 9876543210"
                                    value={formData.emergency_contact_phone}
                                    onChange={handleInputChange}
                                    onBlur={handleBlur("emergency_contact_phone")}
                                />
                                <FormError error={fieldErrors.emergency_contact_phone} />
                            </div>

                            <div className="col-md-6">
                                <label className="form-label fw-semibold" htmlFor="status">Status</label>
                                <select
                                    id="status"
                                    name="status"
                                    className="form-select"
                                    value={formData.status}
                                    onChange={handleInputChange}
                                >
                                    <option value="1">Active</option>
                                    <option value="0">Inactive</option>
                                </select>
                            </div>

                            <div className="col-12">
                                <label className="form-label fw-semibold" htmlFor="bio">Coach Bio & Achievements</label>
                                <textarea
                                    id="bio"
                                    name="bio"
                                    className="form-control"
                                    rows={4}
                                    placeholder="Describe coaching background, career highlights, accomplishments, and coaching philosophy (displayed on public website)..."
                                    value={formData.bio}
                                    onChange={handleInputChange}
                                />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="card-footer bg-light border-top p-3 px-4 d-flex justify-content-between align-items-center">
                    <Link href="/next_panel/coaches" className="btn btn-outline-secondary">
                        Cancel
                    </Link>
                    <button
                        type="submit"
                        className="btn btn-primary d-flex align-items-center gap-2 px-4"
                        disabled={loading}
                    >
                        <Save size={16} />
                        <span>{loading ? "Saving..." : isEdit ? "Update Coach" : "Create Coach"}</span>
                    </button>
                </div>
            </div>
        </form>
    );
}
