"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { FormError } from "@/app/components/form";
import { validateEmail, validatePhone, validatePassword } from "@/app/components/form";

const EMPTY_FORM = {
    appointment_no: "",
    academy_id: "",
    branch_id: "",
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    password: "",
    user_type: "",
    status: 1,
};

export default function UserForm({ id = null, redirectPath = "/next_panel/users", isPublicRegister = false, hideSuperAdmin = false }) {
    const router = useRouter();

    const [formData, setFormData] = useState(EMPTY_FORM);
    const [profileImage, setProfileImage] = useState(null);
    const [existingImageUrl, setExistingImageUrl] = useState(null);

    const [optionsLoading, setOptionsLoading] = useState(false);
    const [lookupMessage, setLookupMessage] = useState("");

    const [academies, setAcademies] = useState([]);
    const [branches, setBranches] = useState([]);
    const [roles, setRoles] = useState([]);
    const [refLoading, setRefLoading] = useState(true);

    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(false);
    const [error, setError] = useState("");
    const [fieldErrors, setFieldErrors] = useState({});
    const isEdit = Boolean(id);

    // LOAD ACADEMY + BRANCH + ROLE OPTIONS
    useEffect(() => {
        const loadRefData = async () => {
            setRefLoading(true);
            try {
                const [academyRes, branchRes, roleRes] = await Promise.all([
                    fetch("/api/academies"),
                    fetch("/api/branch"),
                    fetch("/api/roles"),
                ]);
                const academyJson = await academyRes.json();
                const branchJson = await branchRes.json();
                const roleJson = await roleRes.json();

                if (academyRes.ok && academyJson.success) setAcademies(academyJson.data || []);
                if (branchRes.ok && branchJson.success) setBranches(branchJson.data || []);
                if (roleRes.ok && roleJson.success) setRoles(roleJson.data || []);
            } catch (err) {
                console.error("Failed to load academy/branch/role options:", err);
            } finally {
                setRefLoading(false);
            }
        };
        loadRefData();
    }, []);

    // GET SINGLE USER (edit mode)
    useEffect(() => {
        if (!id) return;
        const getUser = async () => {
            try {
                setFetching(true);
                setError("");
                const res = await fetch(`/api/users/${id}`);
                const result = await res.json();
                if (!res.ok || !result.success) {
                    throw new Error(result.message || "Failed to fetch User");
                }
                const data = result.data;
                setFormData({
                    appointment_no: data.appointment_no || "",
                    academy_id: data.academy_id ?? "",
                    branch_id: data.branch_id ?? "",
                    first_name: data.first_name || "",
                    last_name: data.last_name || "",
                    email: data.email || "",
                    phone: data.phone || "",
                    password: "",
                    user_type: data.user_type || "",
                    status: data.status ?? 1,
                });
                setExistingImageUrl(data.profile_image || null);
            } catch (error) {
                setError(error.message);
            } finally {
                setFetching(false);
            }
        };
        getUser();
    }, [id]);

    // Branches that belong to the currently selected academy.
    const filteredBranches = formData.academy_id
        ? branches.filter((b) => Number(b.academy_id) === Number(formData.academy_id))
        : [];

    // LOOK UP STAFF / PLAYER BY APPOINTMENT NO AND AUTO-FILL USER DETAILS
    useEffect(() => {
        if (isEdit) return;

        const appointmentNo = formData.appointment_no.trim();
        if (!appointmentNo) {
            setLookupMessage("");
            return;
        }

        let cancelled = false;
        const timer = setTimeout(async () => {
            setOptionsLoading(true);
            setLookupMessage("Finding record...");

            try {
                // Search both sources so the appointment/admission number can
                // identify the record without requiring the user to choose it.
                const [staffRes, playerRes] = await Promise.all([
                    fetch("/api/staff"),
                    fetch("/api/admission-players"),
                ]);

                const staffJson = await staffRes.json();
                const playerJson = await playerRes.json();

                if (cancelled) return;

                const staffMatch = (staffJson.data || []).find(
                    (s) => String(s.appointment_no || "").trim().toLowerCase() === appointmentNo.toLowerCase()
                );
                const playerMatch = (playerJson.data || []).find(
                    (p) => String(p.admission_no || "").trim().toLowerCase() === appointmentNo.toLowerCase()
                );

                const match = staffMatch || playerMatch;
                if (!match) {
                    setLookupMessage("No staff/player record found for this Apointment No.");
                    return;
                }

                const isPlayer = !staffMatch && Boolean(playerMatch);
                const guessedType = isPlayer ? "player" : "staff";
                const roleMatch = roles.find(
                    (role) => Number(role.id) === Number(match.role_id)
                ) || roles.find(
                    (role) => String(role.role_name || "").trim().toLowerCase() === guessedType
                );

                setFormData((prev) => ({
                    ...prev,
                    first_name: match.first_name || "",
                    last_name: match.last_name || "",
                    email: match.email || "",
                    phone: match.phone || "",
                    academy_id: match.academy_id ?? prev.academy_id,
                    branch_id: match.branch_id ?? prev.branch_id,
                    user_type: roleMatch ? roleMatch.role_name : (prev.user_type || guessedType),
                }));
                setLookupMessage(isPlayer ? "Player record found." : "Staff record found.");
            } catch (err) {
                if (!cancelled) {
                    setLookupMessage("Unable to find the staff/player record.");
                }
            } finally {
                if (!cancelled) setOptionsLoading(false);
            }
        }, 350);

        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
    }, [formData.appointment_no, isEdit, roles]);

    // HANDLE INPUT
    const handleChange = (e) => {
        const { name, value } = e.target;

        if (fieldErrors[name]) {
            setFieldErrors((prev) => {
                const next = { ...prev };
                delete next[name];
                return next;
            });
        }

        if (name === "user_type") {
            setFormData((prev) => ({
                ...prev,
                user_type: value,
            }));
            return;
        }

        if (name === "academy_id") {
            const newAcademyId = value === "" ? "" : Number(value);
            setFormData((prev) => {
                const branchStillValid = branches.some(
                    (b) =>
                        Number(b.id) === Number(prev.branch_id) &&
                        Number(b.academy_id) === Number(newAcademyId)
                );
                return {
                    ...prev,
                    academy_id: newAcademyId,
                    branch_id: branchStillValid ? prev.branch_id : "",
                };
            });
            return;
        }

        if (name === "branch_id" || name === "status") {
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
        if (field === "appointment_no" && !formData.appointment_no?.trim()) err = "Appointment number is required.";
        if (field === "first_name" && !formData.first_name?.trim()) err = "First name is required.";
        if (field === "user_type" && !formData.user_type) err = "Please select a user type.";
        if (field === "password") {
            if (!isEdit && !formData.password) err = "Password is required.";
            else if (formData.password && formData.password.length < 6) err = "Password must be at least 6 characters.";
        }
        if (field === "email" && formData.email) err = validateEmail(formData.email);
        if (field === "phone" && formData.phone) err = validatePhone(formData.phone);
        if (err) setFieldErrors((prev) => ({ ...prev, [field]: err }));
    };

    const validateAll = () => {
        const errors = {};
        if (!formData.appointment_no?.trim()) {
            errors.appointment_no = formData.user_type?.toLowerCase().includes("player")
                ? "Please select a player record to link."
                : "Please enter an appointment number.";
        }
        if (!formData.first_name?.trim()) errors.first_name = "First name is required.";
        if (!isEdit && !formData.password) {
            errors.password = "Password is required.";
        } else if (formData.password && formData.password.length < 6) {
            errors.password = "Password must be at least 6 characters long.";
        }
        if (!formData.user_type) errors.user_type = "Please select a user type.";
        if (formData.email && validateEmail(formData.email)) errors.email = validateEmail(formData.email);
        if (formData.phone && validatePhone(formData.phone)) errors.phone = validatePhone(formData.phone);

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

    const handleFileChange = (e) => {
        const file = e.target.files?.[0] || null;
        if (file && file.size > 2 * 1024 * 1024) {
            setFieldErrors((prev) => ({ ...prev, profile_image: "Profile image must be less than 2MB." }));
            e.target.value = "";
            setProfileImage(null);
            return;
        }
        if (fieldErrors.profile_image) {
            setFieldErrors((prev) => {
                const next = { ...prev };
                delete next.profile_image;
                return next;
            });
        }
        setProfileImage(file);
    };

    // SUBMIT
    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!validateAll()) return;

        try {
            setLoading(true);
            setError("");

            const url = isEdit ? `/api/users/${id}` : `/api/users`;

            const body = new FormData();
            Object.entries(formData).forEach(([key, value]) => {
                // On edit, an empty password means "keep the existing one" — don't send it.
                if (key === "password" && isEdit && !value) return;
                if (value !== "" && value !== null && value !== undefined) {
                    body.append(key, value);
                }
            });
            if (profileImage) {
                body.append("profile_image", profileImage);
            }

            const res = await fetch(url, {
                method: isEdit ? "PUT" : "POST",
                body,
            });

            // API may return an empty/non-JSON response on an unexpected server error.
            // Read as text first so Response.json() never throws "Unexpected end of JSON input".
            const responseText = await res.text();
            let data = null;

            if (responseText) {
                try {
                    data = JSON.parse(responseText);
                } catch (parseError) {
                    throw new Error(
                        `Server returned an invalid response (${res.status}): ${responseText.slice(0, 300)}`
                    );
                }
            }

            if (!res.ok || !data?.success) {
                throw new Error(
                    data?.message ||
                    `Request failed with status ${res.status}${responseText ? "" : ": empty server response"}`
                );
            }

            alert(isEdit ? "User updated successfully" : isPublicRegister ? "Account created successfully! Please sign in with your credentials." : "User created successfully");
            router.push(redirectPath);
            router.refresh();

        } catch (error) {
            setError(error.message);

        } finally {
            setLoading(false);
        }
    };

    if (fetching) {
        return (
            <div className="text-center py-5">
                Loading...
            </div>
        );
    }

    return (
        <div className={isPublicRegister ? "card border-0 shadow-lg rounded-4 overflow-hidden" : "card shadow-sm"}>
            {isPublicRegister ? (
                <div
                    className="p-4 p-md-5 border-bottom"
                    style={{
                        background: "linear-gradient(135deg, rgba(6,47,56,0.04) 0%, rgba(215,38,61,0.04) 100%)",
                    }}
                >
                    <div className="d-flex align-items-center gap-3">
                        <div
                            className="rounded-circle d-flex align-items-center justify-content-center text-white flex-shrink-0"
                            style={{ width: "52px", height: "52px", background: "var(--red)" }}
                        >
                            <i className="bi bi-person-plus-fill fs-4"></i>
                        </div>
                        <div>
                            <span
                                className="badge mb-1 fw-semibold text-uppercase px-2 py-1"
                                style={{
                                    background: "rgba(215,38,61,0.1)",
                                    color: "var(--red)",
                                    fontSize: "0.75rem",
                                    letterSpacing: "1px",
                                }}
                            >
                                Registration Form
                            </span>
                            <h4 className="display-font text-navy mb-0" style={{ fontSize: "1.6rem" }}>
                                Personal &amp; Account Details
                            </h4>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="card-header">
                    <h5 className="mb-0">
                        {isEdit ? "Edit User" : "Add User"}
                    </h5>
                </div>
            )}

            <div className={isPublicRegister ? "card-body p-4 p-md-5" : "card-body"}>

                {error && (
                    <div className="alert alert-danger">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} encType="multipart/form-data">

                    <div className="mb-3">
                        <label className="form-label" htmlFor="appointment_no">Appointment No <span className="text-danger ms-1">*</span></label>
                        <input
                            id="appointment_no"
                            type="text"
                            name="appointment_no"
                            className={`form-control ${fieldErrors.appointment_no ? "is-invalid border-danger" : ""}`}
                            value={formData.appointment_no}
                            onChange={handleChange}
                            onBlur={handleBlur("appointment_no")}
                            readOnly={isEdit}
                            autoComplete="off"
                            placeholder="Enter Appointment No"
                        />
                        <FormError error={fieldErrors.appointment_no} />
                        {isEdit ? (
                            <div className="form-text">Appointment No cannot be changed while editing.</div>
                        ) : (
                            <div className={`form-text ${lookupMessage.startsWith("No ") || lookupMessage.startsWith("Unable") ? "text-danger" : "text-success"}`}>
                                {lookupMessage || "Enter Appointment No to automatically load staff/player details."}
                            </div>
                        )}
                    </div>

                    <div className="row">
                        <div className="col-md-6 mb-3">
                            <label className="form-label" htmlFor="academy_id">Academy</label>
                            <select
                                id="academy_id"
                                name="academy_id"
                                className="form-select"
                                value={formData.academy_id}
                                onChange={handleChange}
                                disabled={refLoading}
                            >
                                <option value="">
                                    {refLoading ? "Loading academies…" : "Select Academy"}
                                </option>
                                {academies.map((ac) => (
                                    <option key={ac.id} value={ac.id}>{ac.academy_name}</option>
                                ))}
                            </select>
                        </div>
                        <div className="col-md-6 mb-3">
                            <label className="form-label" htmlFor="branch_id">Branch</label>
                            <select
                                id="branch_id"
                                name="branch_id"
                                className="form-select"
                                value={formData.branch_id}
                                onChange={handleChange}
                                disabled={!formData.academy_id}
                            >
                                <option value="">
                                    {formData.academy_id ? "Select Branch" : "Select an academy first"}
                                </option>
                                {filteredBranches.map((b) => (
                                    <option key={b.id} value={b.id}>{b.branch_name}</option>
                                ))}
                            </select>
                            {formData.academy_id && filteredBranches.length === 0 && (
                                <div className="form-text text-danger">
                                    No branches found for the selected academy.
                                </div>
                            )}
                        </div>

                        <div className="col-md-6 mb-3">
                            <label className="form-label" htmlFor="first_name">First Name <span className="text-danger ms-1">*</span></label>
                            <input
                                id="first_name"
                                type="text"
                                name="first_name"
                                className={`form-control ${fieldErrors.first_name ? "is-invalid border-danger" : ""}`}
                                value={formData.first_name}
                                onChange={handleChange}
                                onBlur={handleBlur("first_name")}
                            />
                            <FormError error={fieldErrors.first_name} />
                        </div>
                        <div className="col-md-6 mb-3">
                            <label className="form-label" htmlFor="last_name">Last Name</label>
                            <input
                                id="last_name"
                                type="text"
                                name="last_name"
                                className="form-control"
                                value={formData.last_name}
                                onChange={handleChange}
                            />
                        </div>
                    </div>

                    <div className="row">
                        <div className="col-md-6 mb-3">
                            <label className="form-label" htmlFor="email">Email</label>
                            <input
                                id="email"
                                type="email"
                                name="email"
                                className={`form-control ${fieldErrors.email ? "is-invalid border-danger" : ""}`}
                                value={formData.email}
                                onChange={handleChange}
                                onBlur={handleBlur("email")}
                            />
                            <FormError error={fieldErrors.email} />
                        </div>
                        <div className="col-md-6 mb-3">
                            <label className="form-label" htmlFor="phone">Phone</label>
                            <input
                                id="phone"
                                type="text"
                                name="phone"
                                className={`form-control ${fieldErrors.phone ? "is-invalid border-danger" : ""}`}
                                value={formData.phone}
                                onChange={handleChange}
                                onBlur={handleBlur("phone")}
                            />
                            <FormError error={fieldErrors.phone} />
                        </div>
                    </div>

                    <div className="row">
                        <div className={isPublicRegister ? "col-12 mb-3" : "col-md-6 mb-3"}>
                            <label className="form-label" htmlFor="password">
                                Password {!isEdit && <span className="text-danger ms-1">*</span>} {isEdit && <span className="text-muted">(leave blank to keep current)</span>}
                            </label>
                            <input
                                id="password"
                                type="password"
                                name="password"
                                className={`form-control ${fieldErrors.password ? "is-invalid border-danger" : ""}`}
                                value={formData.password}
                                onChange={handleChange}
                                onBlur={handleBlur("password")}
                                placeholder={isPublicRegister ? "Create a secure account password" : ""}
                            />
                            <FormError error={fieldErrors.password} />
                        </div>
                        {!isPublicRegister && (
                            <div className="col-md-6 mb-3">
                                <label className="form-label" htmlFor="status">Status</label>
                                <select
                                    id="status"
                                    name="status"
                                    className="form-select"
                                    value={formData.status}
                                    onChange={handleChange}
                                >
                                    <option value={1}>Active</option>
                                    <option value={0}>Inactive</option>
                                </select>
                            </div>
                        )}
                    </div>

                    <div className="mb-3">
                        <label className="form-label" htmlFor="user_type">User Type <span className="text-danger ms-1">*</span></label>
                        <select
                            id="user_type"
                            name="user_type"
                            className={`form-select ${fieldErrors.user_type ? "is-invalid border-danger" : ""}`}
                            value={formData.user_type}
                            onChange={handleChange}
                            onBlur={handleBlur("user_type")}
                            disabled={refLoading}
                        >
                            <option value="">
                                {refLoading ? "Loading user types…" : "Select User Type"}
                            </option>
                            {roles
                                .filter((r) => {
                                    if (isPublicRegister || hideSuperAdmin) {
                                        const roleName = String(r.role_name || "").toLowerCase().trim();
                                        return roleName !== "super admin" && !roleName.includes("super admin");
                                    }
                                    return true;
                                })
                                .map((r) => (
                                    <option key={r.id} value={r.role_name}>{r.role_name}</option>
                                ))}
                        </select>
                        <FormError error={fieldErrors.user_type} />
                    </div>

                    {!isEdit && formData.appointment_no && formData.user_type && (
                        <div className="alert alert-light border mb-3">
                            Details loaded automatically from the {formData.user_type.toLowerCase().includes("player") ? "cst_admission_players" : "cst_staff"} record.
                        </div>
                    )}

                    <div className="mb-3">
                        <label className="form-label">Profile Image (JPG, PNG or WEBP, max 2MB)</label>
                        <input
                            type="file"
                            name="profile_image"
                            className={`form-control ${fieldErrors.profile_image ? "is-invalid border-danger" : ""}`}
                            accept=".jpg,.jpeg,.png,.webp"
                            onChange={handleFileChange}
                        />
                        <FormError error={fieldErrors.profile_image} />
                        {existingImageUrl && !profileImage && (
                            <div className="mt-2">
                                <img
                                    src={existingImageUrl}
                                    alt="Current profile"
                                    width={64}
                                    height={64}
                                    className="rounded-circle"
                                    style={{ objectFit: "cover" }}
                                />
                                <div className="form-text">Uploading a new image will replace this one.</div>
                            </div>
                        )}
                    </div>

                    <div className="d-flex flex-wrap gap-3 mt-4 pt-2">
                        <button
                            type="submit"
                            className={isPublicRegister ? "btn btn-red py-3 px-5 d-inline-flex align-items-center justify-content-center" : "btn btn-primary"}
                            disabled={loading}
                        >
                            {loading ? (
                                isPublicRegister ? (
                                    <>
                                        <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                                        Creating Account...
                                    </>
                                ) : (
                                    "Saving..."
                                )
                            ) : isEdit ? (
                                "Update User"
                            ) : isPublicRegister ? (
                                <>
                                    Complete Registration <i className="bi bi-arrow-right ms-2"></i>
                                </>
                            ) : (
                                "Add User"
                            )}
                        </button>

                        <button
                            type="button"
                            className={isPublicRegister ? "btn btn-outline-dark py-3 px-4 rounded-pill" : "btn btn-secondary"}
                            onClick={() =>
                                router.push(isPublicRegister ? "/login" : "/next_panel/users")
                            }
                        >
                            {isPublicRegister ? "Already Registered? Sign In" : "Cancel"}
                        </button>
                    </div>

                </form>
            </div>
        </div>
    );
}