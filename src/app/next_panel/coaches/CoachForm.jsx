"use client";

import { ArrowLeft, CheckCircle2, Save } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useUser } from "../components/UserContext";

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

    const handleSpecializationToggle = (spec) => {
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

        if (!isEdit && !formData.user_id) {
            setError("Please select a User account for this coach profile.");
            return;
        }

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
                                <label className="form-label fw-semibold">
                                    Linked User Account {!isEdit && <span className="text-danger">*</span>}
                                </label>
                                {isEdit ? (
                                    <input
                                        type="text"
                                        className="form-control bg-light"
                                        value={formData.coach_name || `User ID: ${formData.user_id}`}
                                        disabled
                                        readOnly
                                    />
                                ) : (
                                    <select
                                        name="user_id"
                                        className="form-select"
                                        value={formData.user_id}
                                        onChange={handleInputChange}
                                        required
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
                                <div className="form-text">
                                    Coach profile is mapped to this user account in CST Crickinfo.
                                </div>
                            </div>

                            <div className="col-md-6">
                                <label className="form-label fw-semibold">Coach Code</label>
                                <input
                                    type="text"
                                    name="coach_code"
                                    className="form-control"
                                    placeholder="e.g. CCH-001 or STF-2026-0004"
                                    value={formData.coach_code}
                                    onChange={handleInputChange}
                                />
                                <div className="form-text">Unique identification code for this coach.</div>
                            </div>

                            <div className="col-md-6">
                                <label className="form-label fw-semibold">Academy</label>
                                <select
                                    name="academy_id"
                                    className="form-select"
                                    value={formData.academy_id}
                                    onChange={handleInputChange}
                                    disabled={hasAssignedAcademy && !isAcademyAdmin}
                                >
                                    <option value="">Select Academy...</option>
                                    {academies.map((a) => (
                                        <option key={a.id} value={a.id}>
                                            {a.academy_name}
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
                                    onChange={handleInputChange}
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
                            <div className="form-text mt-1">
                                Select one or multiple areas of coaching expertise.
                            </div>
                        </div>

                        <div className="row g-3">
                            <div className="col-md-4">
                                <label className="form-label fw-semibold">Experience (Years)</label>
                                <input
                                    type="number"
                                    step="0.5"
                                    min="0"
                                    max="99"
                                    name="experience_years"
                                    className="form-control"
                                    value={formData.experience_years}
                                    onChange={handleInputChange}
                                />
                            </div>

                            <div className="col-md-4">
                                <label className="form-label fw-semibold">Educational / Cricket Qualification</label>
                                <input
                                    type="text"
                                    name="qualification"
                                    className="form-control"
                                    placeholder="e.g. BCCI Level 2, NIS Certified"
                                    value={formData.qualification}
                                    onChange={handleInputChange}
                                />
                            </div>

                            <div className="col-md-4">
                                <label className="form-label fw-semibold">Previous Academy / Club</label>
                                <input
                                    type="text"
                                    name="previous_academy"
                                    className="form-control"
                                    placeholder="e.g. National Cricket Academy"
                                    value={formData.previous_academy}
                                    onChange={handleInputChange}
                                />
                            </div>

                            <div className="col-12">
                                <label className="form-label fw-semibold">Certifications & Accreditations</label>
                                <textarea
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
                                <label className="form-label fw-semibold">Employment Type</label>
                                <select
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
                                <label className="form-label fw-semibold">Gender</label>
                                <select
                                    name="gender"
                                    className="form-select"
                                    value={formData.gender}
                                    onChange={handleInputChange}
                                >
                                    <option value="Male">Male</option>
                                    <option value="Female">Female</option>
                                    <option value="Other">Other</option>
                                </select>
                            </div>

                            <div className="col-md-3">
                                <label className="form-label fw-semibold">Date of Birth</label>
                                <input
                                    type="date"
                                    name="date_of_birth"
                                    className="form-control"
                                    value={formData.date_of_birth}
                                    onChange={handleInputChange}
                                />
                            </div>

                            <div className="col-md-3">
                                <label className="form-label fw-semibold">Joining Date</label>
                                <input
                                    type="date"
                                    name="joining_date"
                                    className="form-control"
                                    value={formData.joining_date}
                                    onChange={handleInputChange}
                                />
                            </div>

                            <div className="col-md-4">
                                <label className="form-label fw-semibold">Monthly Salary (₹)</label>
                                <input
                                    type="number"
                                    step="100"
                                    name="salary"
                                    className="form-control"
                                    placeholder="Optional"
                                    value={formData.salary}
                                    onChange={handleInputChange}
                                />
                            </div>

                            <div className="col-md-4">
                                <label className="form-label fw-semibold">Emergency Contact Name</label>
                                <input
                                    type="text"
                                    name="emergency_contact_name"
                                    className="form-control"
                                    placeholder="e.g. Next of Kin"
                                    value={formData.emergency_contact_name}
                                    onChange={handleInputChange}
                                />
                            </div>

                            <div className="col-md-4">
                                <label className="form-label fw-semibold">Emergency Contact Phone</label>
                                <input
                                    type="tel"
                                    name="emergency_contact_phone"
                                    className="form-control"
                                    placeholder="e.g. +91 9876543210"
                                    value={formData.emergency_contact_phone}
                                    onChange={handleInputChange}
                                />
                            </div>

                            <div className="col-md-6">
                                <label className="form-label fw-semibold">Status</label>
                                <select
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
                                <label className="form-label fw-semibold">Coach Bio & Achievements</label>
                                <textarea
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
