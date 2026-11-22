"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useUser } from "../components/UserContext";
import { FormError } from "@/app/components/form";

const EMPTY_FORM = {
    user_id: "",
    role_id: "",
    academy_id: "",
    branch_id: "",
    first_name: "",
    last_name: "",
    father_name: "",
    mother_name: "",
    gender: "",
    speciality: "",
    experience: "",
    previous_academy: "",
    previous_academy_duration: "",
    qualification: "",
    achievement: "",
    last_salary: "",
    current_salary: "",
    dob: "",
    date_of_joining: "",
    date_of_appointment: "",
    status: 1,
};

export default function StaffForm({ id = null }) {
    const router = useRouter();
    const {user} = useUser();

    const [formData, setFormData] = useState(EMPTY_FORM);
    const [appointmentNo, setAppointmentNo] = useState(""); // read-only, shown only in edit mode
    const [createdAppointmentNo, setCreatedAppointmentNo] = useState(null); // drives the success popup

    const [branches, setBranches] = useState([]);
    const [roles, setRoles] = useState([]);

    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(false);
    const [optionsLoading, setOptionsLoading] = useState(true);
    const [error, setError] = useState("");
    const [fieldErrors, setFieldErrors] = useState({});
    const [academies, setAcademies] = useState([]);
    const isEdit = Boolean(id);
    const hasSessionUser = Boolean(user);
    const userAcademyId = user?.academy_id;
    const userBranchId = user?.branch_id;
    const hasAssignedAcademy =
        userAcademyId !== null &&
        userAcademyId !== undefined &&
        userAcademyId !== "" &&
        Number(userAcademyId) > 0;
    const isAcademyAdmin = user?.user_type === "Academy Admin";
    const hasAssignedBranch =
        userBranchId !== null &&
        userBranchId !== undefined &&
        userBranchId !== "" &&
        Number(userBranchId) > 0;
    const isBranchRestricted = hasAssignedAcademy && !isAcademyAdmin;

    // LOAD BRANCH + ROLE OPTIONS
    useEffect(() => {
        if (!hasSessionUser) return;

        const loadOptions = async () => {
            setOptionsLoading(true);
            try {
                const branchUrl = hasAssignedAcademy
                    ? `/api/branch?academy_id=${userAcademyId}`
                    : "/api/branch";
                const [academyRes, branchRes, roleRes] = await Promise.all([
                    fetch("/api/academies"),
                    fetch(branchUrl),
                    fetch("/api/roles"),
                ]);
                const academyJson = await academyRes.json();
                const branchJson = await branchRes.json();
                const roleJson = await roleRes.json();

                if (!academyRes.ok || !academyJson.success) {
                    throw new Error(academyJson.message || "Faild to load Academies");
                }
                if (!branchRes.ok || !branchJson.success) {
                    throw new Error(branchJson.message || "Failed to load branches");
                }
                if (!roleRes.ok || !roleJson.success) {
                    throw new Error(roleJson.message || "Failed to load roles");
                }
                const academyList = academyJson.data || [];
                setAcademies(
                    hasAssignedAcademy
                        ? academyList.filter((academy) => Number(academy.id) === Number(userAcademyId))
                        : academyList
                );
                setBranches(branchJson.data || []);
                setRoles(roleJson.data.filter((item)=>item.id !== 7) || []);
                if (!isEdit && hasAssignedAcademy) {
                    setFormData((current) => ({
                        ...current,
                        academy_id: Number(userAcademyId),
                        branch_id: isBranchRestricted && hasAssignedBranch
                            ? Number(userBranchId)
                            : current.branch_id,
                    }));
                }
            } catch (error) {
                setError(error.message);
            } finally {
                setOptionsLoading(false);
            }
        };
        loadOptions();
    }, [hasSessionUser, hasAssignedAcademy, userAcademyId, userBranchId, hasAssignedBranch, isBranchRestricted, isEdit]);

    // GET SINGLE STAFF (edit mode)
    useEffect(() => {
        if (!id) return;
        const getStaff = async () => {
            try {
                setFetching(true);
                setError("");
                const res = await fetch(`/api/staff/${id}`);
                const result = await res.json();
                if (!res.ok || !result.success) {
                    throw new Error(result.message || "Failed to fetch Staff");
                }
                const data = result.data;
                setAppointmentNo(data.appointment_no || "");
                setFormData({
                    user_id: data.user_id ?? "",
                    role_id: data.role_id ?? "",
                    academy_id: data.academy_id ?? "",
                    branch_id: data.branch_id ?? "",
                    first_name: data.first_name || "",
                    last_name: data.last_name || "",
                    father_name: data.father_name || "",
                    mother_name: data.mother_name || "",
                    gender: data.gender || "",
                    speciality: data.speciality || "",
                    experience: data.experience ?? "",
                    previous_academy: data.previous_academy || "",
                    previous_academy_duration: data.previous_academy_duration ?? "",
                    qualification: data.qualification || "",
                    achievement: data.achievement || "",
                    last_salary: data.last_salary ?? "",
                    current_salary: data.current_salary ?? "",
                    dob: data.dob ? String(data.dob).slice(0, 10) : "",
                    date_of_joining: data.date_of_joining ? String(data.date_of_joining).slice(0, 10) : "",
                    date_of_appointment: data.date_of_appointment ? String(data.date_of_appointment).slice(0, 10) : "",
                    status: data.status ?? 1,
                });
            } catch (error) {
                setError(error.message);
            } finally {
                setFetching(false);
            }
        };
        getStaff();
    }, [id]);

    // Branches that belong to the currently selected academy.
    // Nothing is shown until an academy is picked, so a branch from a
    // different academy can never be selected.
    const filteredBranches = formData.academy_id
        ? branches.filter((branch) =>
            Number(branch.academy_id) === Number(formData.academy_id) &&
            (!isBranchRestricted || (hasAssignedBranch && Number(branch.id) === Number(userBranchId)))
        )
        : [];

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

        // Changing the academy must re-validate the branch: if the branch
        // currently selected doesn't belong to the newly chosen academy,
        // clear it so an invalid academy/branch pair can never be submitted.
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

        if (["branch_id", "role_id", "status"].includes(name)) {
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
        if (field === "first_name" && !formData.first_name.trim()) err = "First name is required.";
        if (field === "academy_id" && !formData.academy_id) err = "Please select an academy.";
        if (field === "branch_id" && !formData.branch_id) err = "Please select a branch.";
        if (field === "role_id" && !formData.role_id) err = "Please select a role.";
        if (field === "gender" && !formData.gender) err = "Please select a gender.";
        if (field === "dob" && !formData.dob) err = "Date of birth is required.";
        if (field === "speciality" && !formData.speciality?.trim()) err = "Speciality is required.";
        if (field === "experience") {
            if (formData.experience === "" || formData.experience === null || formData.experience === undefined) {
                err = "Experience is required.";
            } else if (isNaN(Number(formData.experience)) || Number(formData.experience) < 0) {
                err = "Experience must be a valid non-negative number.";
            }
        }
        if (field === "last_salary") {
            if (formData.last_salary === "" || formData.last_salary === null || formData.last_salary === undefined) {
                err = "Last salary is required.";
            } else if (isNaN(Number(formData.last_salary)) || Number(formData.last_salary) < 0) {
                err = "Last salary must be a valid non-negative number.";
            }
        }
        if (field === "date_of_joining" && !formData.date_of_joining) err = "Date of joining is required.";
        if (field === "date_of_appointment" && !formData.date_of_appointment) err = "Date of appointment is required.";

        if (err) setFieldErrors((prev) => ({ ...prev, [field]: err }));
    };

    const validateAll = () => {
        const errors = {};
        if (!formData.first_name.trim()) errors.first_name = "First name is required.";
        if (!formData.academy_id) errors.academy_id = "Please select an academy.";
        if (!formData.branch_id) errors.branch_id = "Please select a branch.";
        if (!formData.role_id) errors.role_id = "Please select a role.";
        if (!formData.gender) errors.gender = "Please select a gender.";
        if (!formData.dob) errors.dob = "Date of birth is required.";
        if (!formData.speciality?.trim()) errors.speciality = "Speciality is required.";

        if (formData.experience === "" || formData.experience === null || formData.experience === undefined) {
            errors.experience = "Experience is required.";
        } else if (isNaN(Number(formData.experience)) || Number(formData.experience) < 0) {
            errors.experience = "Experience must be a valid non-negative number.";
        }

        if (formData.last_salary === "" || formData.last_salary === null || formData.last_salary === undefined) {
            errors.last_salary = "Last salary is required.";
        } else if (isNaN(Number(formData.last_salary)) || Number(formData.last_salary) < 0) {
            errors.last_salary = "Last salary must be a valid non-negative number.";
        }

        if (!formData.date_of_joining) errors.date_of_joining = "Date of joining is required.";
        if (!formData.date_of_appointment) errors.date_of_appointment = "Date of appointment is required.";

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

    // SUBMIT
    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!validateAll()) return;

        try {
            setLoading(true);
            setError("");

            const url = isEdit
                ? `/api/staff/${id}`
                : `/api/staff`;

            const payload = {
                ...formData,
                user_id: formData.user_id || null,
                speciality: formData.speciality.trim(),
                experience: Number(formData.experience),
                previous_academy_duration: formData.previous_academy_duration === "" ? null : Number(formData.previous_academy_duration),
                last_salary: Number(formData.last_salary),
                current_salary: formData.current_salary === "" ? 0 : Number(formData.current_salary),
                dob: formData.dob,
                date_of_joining: formData.date_of_joining,
                date_of_appointment: formData.date_of_appointment,
            };

            const res = await fetch(url, {
                method: isEdit ? "PUT" : "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            const data = await res.json();

            if (!res.ok || !data.success) {
                if (data.errors) {
                    setFieldErrors(data.errors);
                    const firstKey = Object.keys(data.errors)[0];
                    const el = document.querySelector(`[name="${firstKey}"], #${firstKey}`);
                    if (el) {
                        el.focus();
                        el.scrollIntoView({ behavior: "smooth", block: "center" });
                    }
                }
                throw new Error(data.message || "Something went wrong");
            }

            if (isEdit) {
                alert("Staff updated successfully");
                router.push("/next_panel/staff");
                router.refresh();
            } else {
                // Show the auto-generated appointment number rather than
                // navigating away immediately, so it isn't missed.
                setCreatedAppointmentNo(data.data?.appointment_no || null);
            }

        } catch (error) {
            setError(error.message);

        } finally {
            setLoading(false);
        }
    };

    const handlePopupClose = () => {
        setCreatedAppointmentNo(null);
        router.push("/next_panel/staff");
        router.refresh();
    };

    const handleAddAnother = () => {
        setCreatedAppointmentNo(null);
        setFormData(EMPTY_FORM);
    };

    if (fetching || optionsLoading) {
        return (
            <div className="text-center py-5">
                Loading...
            </div>
        );
    }

    return (
        <>
            {createdAppointmentNo && (
                <div
                    className="modal d-block"
                    tabIndex={-1}
                    style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
                    role="dialog"
                >
                    <div className="modal-dialog modal-dialog-centered">
                        <div className="modal-content">
                            <div className="modal-body text-center p-4">
                                <h5 className="mb-3">Staff Added Successfully</h5>
                                <p className="text-muted mb-2">Appointment Number</p>
                                <div className="display-6 fw-bold text-primary mb-4">
                                    {createdAppointmentNo}
                                </div>
                                <div className="d-flex justify-content-center gap-2">
                                    <button
                                        type="button"
                                        className="btn btn-outline-secondary"
                                        onClick={handleAddAnother}
                                    >
                                        Add Another
                                    </button>
                                    <button
                                        type="button"
                                        className="btn btn-primary"
                                        onClick={handlePopupClose}
                                    >
                                        Go to List
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <div className="card shadow-sm">
                <div className="card-header">
                    <h5 className="mb-0">
                        {isEdit ? "Edit Staff" : "Add Staff"}
                    </h5>
                </div>

                <div className="card-body">

                    {error && (
                        <div className="alert alert-danger">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit}>

                        <div className="row">
                            {isEdit && (
                                <div className="col-md-6 mb-3">
                                    <label className="form-label">Appointment No</label>
                                    <input
                                        type="text"
                                        className="form-control"
                                        value={appointmentNo}
                                        readOnly
                                        disabled
                                    />
                                    <div className="form-text">Auto-generated on creation — cannot be changed.</div>
                                </div>
                            )}
                            <div className={isEdit ? "col-md-6 mb-3" : "col-md-12 mb-3"}>
                                <label className="form-label">User ID</label>
                                <input
                                    type="text"
                                    name="user_id"
                                    className="form-control"
                                    value={formData.user_id}
                                    onChange={handleChange}
                                    placeholder="Linked user account ID, if any"
                                    readOnly
                                    disabled
                                />
                            </div>
                        </div>

                        {!isEdit && (
                            <div className="alert alert-info py-2">
                                The appointment number will be generated automatically once this staff member is saved.
                            </div>
                        )}

                        <div className="row">
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
                                <label className="form-label">Father&apos;s Name</label>
                                <input
                                    type="text"
                                    name="father_name"
                                    className="form-control"
                                    value={formData.father_name}
                                    onChange={handleChange}
                                />
                            </div>
                            <div className="col-md-6 mb-3">
                                <label className="form-label">Mother&apos;s Name</label>
                                <input
                                    type="text"
                                    name="mother_name"
                                    className="form-control"
                                    value={formData.mother_name}
                                    onChange={handleChange}
                                />
                            </div>
                        </div>

                        <div className="row">
                            <div className="col-md-4 mb-3">
                                <label className="form-label" htmlFor="gender">Gender <span className="text-danger ms-1">*</span></label>
                                <select
                                    id="gender"
                                    name="gender"
                                    className={`form-select ${fieldErrors.gender ? "is-invalid border-danger" : ""}`}
                                    value={formData.gender}
                                    onChange={handleChange}
                                    onBlur={handleBlur("gender")}
                                    required
                                >
                                    <option value="">Select Gender</option>
                                    <option value="male">Male</option>
                                    <option value="female">Female</option>
                                    <option value="other">Other</option>
                                </select>
                                <FormError error={fieldErrors.gender} />
                            </div>
                            <div className="col-md-4 mb-3">
                                <label className="form-label" htmlFor="dob">Date of Birth <span className="text-danger ms-1">*</span></label>
                                <input
                                    id="dob"
                                    type="date"
                                    name="dob"
                                    className={`form-control ${fieldErrors.dob ? "is-invalid border-danger" : ""}`}
                                    value={formData.dob}
                                    onChange={handleChange}
                                    onBlur={handleBlur("dob")}
                                    required
                                />
                                <FormError error={fieldErrors.dob} />
                            </div>
                            <div className="col-md-4 mb-3">
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
                        </div>

                        <div className="row">
                            <div className="col-md-6 mb-3">
                                <label className="form-label" htmlFor="academy_id">Academy <span className="text-danger ms-1">*</span></label>
                                <select
                                    id="academy_id"
                                    name="academy_id"
                                    className={`form-select ${fieldErrors.academy_id ? "is-invalid border-danger" : ""}`}
                                    value={formData.academy_id}
                                    onChange={handleChange}
                                    onBlur={handleBlur("academy_id")}
                                    disabled={hasAssignedAcademy}
                                >
                                    <option value="">Select Academy</option>
                                    {academies.map((ac) => (
                                        <option key={ac.id} value={ac.id}>{ac.academy_name}</option>
                                    ))}
                                </select>
                                <FormError error={fieldErrors.academy_id} />
                            </div>
                            <div className="col-md-6 mb-3">
                                <label className="form-label" htmlFor="branch_id">Branch <span className="text-danger ms-1">*</span></label>
                                <select
                                    id="branch_id"
                                    name="branch_id"
                                    className={`form-select ${fieldErrors.branch_id ? "is-invalid border-danger" : ""}`}
                                    value={formData.branch_id}
                                    onChange={handleChange}
                                    onBlur={handleBlur("branch_id")}
                                    disabled={!formData.academy_id || isBranchRestricted}
                                >
                                    <option value="">
                                        {formData.academy_id ? "Select Branch" : "Select an academy first"}
                                    </option>
                                    {filteredBranches.map((b) => (
                                        <option key={b.id} value={b.id}>{b.branch_name}</option>
                                    ))}
                                </select>
                                <FormError error={fieldErrors.branch_id} />
                                {formData.academy_id && filteredBranches.length === 0 && (
                                    <div className="form-text text-danger">
                                        No branches found for the selected academy.
                                    </div>
                                )}
                            </div>
                            <div className="col-md-6 mb-3">
                                <label className="form-label" htmlFor="role_id">Role <span className="text-danger ms-1">*</span></label>
                                <select
                                    id="role_id"
                                    name="role_id"
                                    className={`form-select ${fieldErrors.role_id ? "is-invalid border-danger" : ""}`}
                                    value={formData.role_id}
                                    onChange={handleChange}
                                    onBlur={handleBlur("role_id")}
                                >
                                    <option value="">Select Role</option>
                                    {roles.map((r) => (
                                        <option key={r.id} value={r.id}>{r.role_name}</option>
                                    ))}
                                </select>
                                <FormError error={fieldErrors.role_id} />
                                {Number(formData.role_id) === 5 && (
                                    <div className="form-text text-success">
                                        <i className="bi bi-info-circle me-1"></i>
                                        Coach role selected: This staff member will automatically be registered in CST Coaches.
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="row">
                            <div className="col-md-6 mb-3">
                                <label className="form-label" htmlFor="speciality">Speciality <span className="text-danger ms-1">*</span></label>
                                <input
                                    id="speciality"
                                    type="text"
                                    name="speciality"
                                    className={`form-control ${fieldErrors.speciality ? "is-invalid border-danger" : ""}`}
                                    value={formData.speciality}
                                    onChange={handleChange}
                                    onBlur={handleBlur("speciality")}
                                    required
                                />
                                <FormError error={fieldErrors.speciality} />
                            </div>
                            <div className="col-md-6 mb-3">
                                <label className="form-label" htmlFor="experience">Experience (years) <span className="text-danger ms-1">*</span></label>
                                <input
                                    id="experience"
                                    type="number"
                                    min="0"
                                    step="0.1"
                                    name="experience"
                                    className={`form-control ${fieldErrors.experience ? "is-invalid border-danger" : ""}`}
                                    value={formData.experience}
                                    onChange={handleChange}
                                    onBlur={handleBlur("experience")}
                                    required
                                />
                                <FormError error={fieldErrors.experience} />
                            </div>
                        </div>

                        <div className="mb-3">
                            <label className="form-label">Qualification</label>
                            <textarea
                                name="qualification"
                                className="form-control"
                                rows={2}
                                value={formData.qualification}
                                onChange={handleChange}
                            />
                        </div>

                        <div className="mb-3">
                            <label className="form-label">Achievement</label>
                            <textarea
                                name="achievement"
                                className="form-control"
                                rows={2}
                                value={formData.achievement}
                                onChange={handleChange}
                            />
                        </div>

                        <div className="row">
                            <div className="col-md-6 mb-3">
                                <label className="form-label">Previous Academy</label>
                                <input
                                    type="text"
                                    name="previous_academy"
                                    className="form-control"
                                    value={formData.previous_academy}
                                    onChange={handleChange}
                                />
                            </div>
                            <div className="col-md-6 mb-3">
                                <label className="form-label">Previous Academy Duration (years)</label>
                                <input
                                    type="number"
                                    min="0"
                                    step="0.1"
                                    name="previous_academy_duration"
                                    className="form-control"
                                    value={formData.previous_academy_duration}
                                    onChange={handleChange}
                                />
                            </div>
                        </div>

                        <div className="row">
                            <div className="col-md-6 mb-3">
                                <label className="form-label" htmlFor="last_salary">Last Salary <span className="text-danger ms-1">*</span></label>
                                <input
                                    id="last_salary"
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    name="last_salary"
                                    className={`form-control ${fieldErrors.last_salary ? "is-invalid border-danger" : ""}`}
                                    value={formData.last_salary}
                                    onChange={handleChange}
                                    onBlur={handleBlur("last_salary")}
                                    placeholder="0.00"
                                    required
                                />
                                <FormError error={fieldErrors.last_salary} />
                            </div>
                            <div className="col-md-6 mb-3">
                                <label className="form-label">Current Salary</label>
                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    name="current_salary"
                                    className="form-control"
                                    value={formData.current_salary}
                                    onChange={handleChange}
                                    placeholder="0.00"
                                />
                            </div>
                        </div>

                        <div className="row">
                            <div className="col-md-6 mb-3">
                                <label className="form-label" htmlFor="date_of_joining">Date of Joining <span className="text-danger ms-1">*</span></label>
                                <input
                                    id="date_of_joining"
                                    type="date"
                                    name="date_of_joining"
                                    className={`form-control ${fieldErrors.date_of_joining ? "is-invalid border-danger" : ""}`}
                                    value={formData.date_of_joining}
                                    onChange={handleChange}
                                    onBlur={handleBlur("date_of_joining")}
                                    required
                                />
                                <FormError error={fieldErrors.date_of_joining} />
                            </div>
                            <div className="col-md-6 mb-3">
                                <label className="form-label" htmlFor="date_of_appointment">Date of Appointment <span className="text-danger ms-1">*</span></label>
                                <input
                                    id="date_of_appointment"
                                    type="date"
                                    name="date_of_appointment"
                                    className={`form-control ${fieldErrors.date_of_appointment ? "is-invalid border-danger" : ""}`}
                                    value={formData.date_of_appointment}
                                    onChange={handleChange}
                                    onBlur={handleBlur("date_of_appointment")}
                                    required
                                />
                                <FormError error={fieldErrors.date_of_appointment} />
                            </div>
                        </div>

                        <div className="d-flex gap-2">
                            <button
                                type="submit"
                                className="btn btn-primary"
                                disabled={loading}
                            >
                                {loading
                                    ? "Saving..."
                                    : isEdit
                                        ? "Update Staff"
                                        : "Add Staff"
                                }
                            </button>

                            <button
                                type="button"
                                className="btn btn-secondary"
                                onClick={() =>
                                    router.push("/next_panel/staff")
                                }
                            >
                                Cancel
                            </button>
                        </div>

                    </form>
                </div>
            </div>
        </>
    );
}