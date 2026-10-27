"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

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

    const handleFileChange = (e) => {
        const file = e.target.files?.[0] || null;
        setProfileImage(file);
    };

    // SUBMIT
    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!formData.first_name.trim()) {
            setError("First name is required");
            return;
        }
        if (!isEdit && !formData.password) {
            setError("Password is required");
            return;
        }
        if (!formData.user_type) {
            setError("Please select a user type");
            return;
        }
        if (!formData.appointment_no) {
            setError(
                formData.user_type.toLowerCase() === "player"
                    ? "Please select a player record to link"
                    : "Please select a staff record to link"
            );
            return;
        }

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
                        <label className="form-label">Apointment No</label>
                        <input
                            type="text"
                            name="appointment_no"
                            className="form-control"
                            value={formData.appointment_no}
                            onChange={handleChange}
                            readOnly={isEdit}
                            required
                            autoComplete="off"
                            placeholder="Enter Apointment No"
                        />
                        {isEdit ? (
                            <div className="form-text">Apointment No cannot be changed while editing.</div>
                        ) : (
                            <div className={`form-text ${lookupMessage.startsWith("No ") || lookupMessage.startsWith("Unable") ? "text-danger" : "text-success"}`}>
                                {lookupMessage || "Enter Apointment No to automatically load staff/player details."}
                            </div>
                        )}
                    </div>

                    <div className="row">
                        <div className="col-md-6 mb-3">
                            <label className="form-label">Academy</label>
                            <select
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
                            <label className="form-label">Branch</label>
                            <select
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
                            <label className="form-label">First Name</label>
                            <input
                                type="text"
                                name="first_name"
                                className="form-control"
                                value={formData.first_name}
                                onChange={handleChange}
                                required
                            />
                        </div>
                        <div className="col-md-6 mb-3">
                            <label className="form-label">Last Name</label>
                            <input
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
                            <label className="form-label">Email</label>
                            <input
                                type="email"
                                name="email"
                                className="form-control"
                                value={formData.email}
                                onChange={handleChange}
                            />
                        </div>
                        <div className="col-md-6 mb-3">
                            <label className="form-label">Phone</label>
                            <input
                                type="text"
                                name="phone"
                                className="form-control"
                                value={formData.phone}
                                onChange={handleChange}
                            />
                        </div>
                    </div>

                    <div className="row">
                        <div className={isPublicRegister ? "col-12 mb-3" : "col-md-6 mb-3"}>
                            <label className="form-label">
                                Password {isEdit && <span className="text-muted">(leave blank to keep current)</span>}
                            </label>
                            <input
                                type="password"
                                name="password"
                                className="form-control"
                                value={formData.password}
                                onChange={handleChange}
                                required={!isEdit}
                                placeholder={isPublicRegister ? "Create a secure account password" : ""}
                            />
                        </div>
                        {!isPublicRegister && (
                            <div className="col-md-6 mb-3">
                                <label className="form-label">Status</label>
                                <select
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
                        <label className="form-label">User Type</label>
                        <select
                            name="user_type"
                            className="form-select"
                            value={formData.user_type}
                            onChange={handleChange}
                            disabled={refLoading}
                            required
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
                    </div>

                    {!isEdit && formData.appointment_no && formData.user_type && (
                        <div className="alert alert-light border mb-3">
                            Details loaded automatically from the {formData.user_type.toLowerCase() === "player" ? "cst_admission_players" : "cst_staff"} record.
                        </div>
                    )}

                    <div className="mb-3">
                        <label className="form-label">Profile Image (JPG, PNG or WEBP, max 5MB)</label>
                        <input
                            type="file"
                            name="profile_image"
                            className="form-control"
                            accept=".jpg,.jpeg,.png,.webp"
                            onChange={handleFileChange}
                        />
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