
"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { useUser } from "../components/UserContext";

const EMPTY_FORM = {
    user_id: "",
    program_id: "",
    admission_no: "",
    first_name: "",
    last_name: "",
    father_name: "",
    mother_name: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    state: "",
    pin_code: "",
    under_age: 0,
    age_group_id: "",
    gender: "",
    aadhaar_no: "",
    playing_academy: "",
    branch_id: "",
    role_id: "",
    status: 1,
    paid_amount: "",
    payment_mode: "Cash",
    transaction_no: "",
    payment_remarks: "",
};

export default function AdmissionPlayerForm({ id = null }) {
    const router = useRouter();

    const [formData, setFormData] = useState(EMPTY_FORM);

    const [admissionNo, setAdmissionNo] = useState("");
    const [aadhaarFile, setAadhaarFile] = useState(null);
    const [existingAadhaarUrl, setExistingAadhaarUrl] = useState(null);
    const [createdAdmissionNo, setCreatedAdmissionNo] = useState(null);

    const [branches, setBranches] = useState([]);
    const [roles, setRoles] = useState([]);
    const [ageGroups, setAgeGroups] = useState([]);
    const [programs, setPrograms] = useState([]);

    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(false);
    const [optionsLoading, setOptionsLoading] = useState(true);
    const [programsLoading, setProgramsLoading] = useState(false);

    const [error, setError] = useState("");

    const isEdit = Boolean(id);

    const {user} = useUser();
    /* =====================================================
       LOAD BRANCH / ROLE / AGE GROUP
    ===================================================== */

    useEffect(() => {
        const loadOptions = async () => {
            setOptionsLoading(true);
            setError("");

            try {
                const [
                    branchRes,
                    roleRes,
                    ageGroupRes,
                ] = await Promise.all([
                    fetch("/api/branch"),
                    fetch("/api/roles"),
                    fetch("/api/age-groups"),
                ]);

                const branchJson = await branchRes.json();
                const roleJson = await roleRes.json();
                const ageGroupJson = await ageGroupRes.json();

                if (!branchRes.ok || !branchJson.success) {
                    throw new Error(
                        branchJson.message ||
                        "Failed to load branches"
                    );
                }

                if (!roleRes.ok || !roleJson.success) {
                    throw new Error(
                        roleJson.message ||
                        "Failed to load roles"
                    );
                }

                if (!ageGroupRes.ok || !ageGroupJson.success) {
                    throw new Error(
                        ageGroupJson.message ||
                        "Failed to load age groups"
                    );
                }

                setBranches(branchJson.data || []);
                setRoles(roleJson.data || []);
                setAgeGroups(ageGroupJson.data || []);

            } catch (error) {
                setError(error.message);
            } finally {
                setOptionsLoading(false);
            }
        };

        loadOptions();
    }, []);

    /* =====================================================
       LOAD PROGRAMS WHEN BRANCH CHANGES
    ===================================================== */

    useEffect(() => {
        let isMounted = true;
        const loadPrograms = async () => {
            if (!formData.branch_id) {
                if (isMounted) {
                    setPrograms([]);
                    setProgramsLoading(false);
                }
                return;
            }

            setProgramsLoading(true);
            setError("");

            try {
                const res = await fetch(
                    `/api/programs?branch_id=${formData.branch_id}&status=1`
                );

                const json = await res.json();

                if (!res.ok || !json.success) {
                    throw new Error(
                        json.message ||
                        "Failed to load programs"
                    );
                }

                if (isMounted) {
                    setPrograms(json.data || []);
                }

            } catch (error) {
                if (isMounted) {
                    setPrograms([]);
                    setError(error.message);
                }
            } finally {
                if (isMounted) {
                    setProgramsLoading(false);
                }
            }
        };

        loadPrograms();
        return () => {
            isMounted = false;
        };
    }, [formData.branch_id]);

    /* =====================================================
       GET SINGLE PLAYER - EDIT MODE
    ===================================================== */

    useEffect(() => {
        if (!id) return;

        const getPlayer = async () => {
            try {
                setFetching(true);
                setError("");

                const res = await fetch(
                    `/api/admission-players/${id} `
                );

                const result = await res.json();

                if (!res.ok || !result.success) {
                    throw new Error(
                        result.message ||
                        "Failed to fetch player"
                    );
                }

                const data = result.data;

                setAdmissionNo(
                    data.admission_no || ""
                );

                setFormData({
                    user_id: data.user_id ?? "",

                    program_id:
                        data.program_id ??
                        "",

                    admission_no:
                        data.admission_no ??
                        "",

                    first_name:
                        data.first_name || "",

                    last_name:
                        data.last_name || "",

                    father_name:
                        data.father_name || "",

                    mother_name:
                        data.mother_name || "",

                    email:
                        data.email || "",

                    phone:
                        data.phone || "",

                    address:
                        data.address || "",

                    city:
                        data.city || "",

                    state:
                        data.state || "",

                    pin_code:
                        data.pin_code || "",

                    under_age:
                        data.under_age ?? 0,

                    age_group_id:
                        data.age_group_id ?? "",

                    gender:
                        data.gender || "",

                    aadhaar_no:
                        data.aadhaar_no || "",

                    playing_academy:
                        data.playing_academy || "",

                    branch_id:
                        data.branch_id ?? "",

                    role_id:
                        data.role_id ?? "",

                    status:
                        data.status ?? 1,
                });

                setExistingAadhaarUrl(
                    data.aadhaar_card || null
                );

            } catch (error) {
                setError(error.message);

            } finally {
                setFetching(false);
            }
        };

        getPlayer();
    }, [id]);

    /* =====================================================
       HANDLE INPUT CHANGE
    ===================================================== */

    const handleChange = (e) => {
        const { name, value } = e.target;

        /* ---------------------------------------------
           BRANCH CHANGE
        --------------------------------------------- */

        if (name === "branch_id") {
            setFormData((prev) => ({
                ...prev,

                branch_id:
                    value === ""
                        ? ""
                        : Number(value),

                // Important:
                // Reset old program when branch changes
                program_id: "",
            }));

            return;
        }

        /* ---------------------------------------------
           NUMERIC FIELDS
        --------------------------------------------- */

        if (
            [
                "role_id",
                "program_id",
                "age_group_id",
                "under_age",
                "status",
            ].includes(name)
        ) {
            setFormData((prev) => ({
                ...prev,

                [name]:
                    value === ""
                        ? ""
                        : Number(value),
            }));

            return;
        }

        /* ---------------------------------------------
           NORMAL FIELDS
        --------------------------------------------- */

        setFormData((prev) => ({
            ...prev,
            [name]: value,
        }));
    };

    /* =====================================================
       FILE CHANGE
    ===================================================== */

    const handleFileChange = (e) => {
        const file =
            e.target.files?.[0] || null;

        setAadhaarFile(file);
    };

    /* =====================================================
       SUBMIT
    ===================================================== */

    const handleSubmit = async (e) => {
        e.preventDefault();

        setError("");

        /* ---------------------------------------------
           REQUIRED VALIDATION
        --------------------------------------------- */

        if (
            !formData.first_name ||
            !formData.first_name.trim()
        ) {
            setError(
                "First name is required"
            );
            return;
        }

        if (!formData.branch_id) {
            setError(
                "Please select a branch"
            );
            return;
        }

        if (!formData.role_id) {
            setError(
                "Please select a role"
            );
            return;
        }

        if (!formData.program_id) {
            setError(
                "Please select a program"
            );
            return;
        }

        /* ---------------------------------------------
           SUBMIT
        --------------------------------------------- */

        try {
            setLoading(true);

            const url = isEdit
                ? `/api/admission-players/${id}`
                : `/api/admission-players`;

            const body = new FormData();

            Object.entries(formData).forEach(
                ([key, value]) => {
                    if (
                        value !== "" &&
                        value !== null &&
                        value !== undefined
                    ) {
                        body.append(
                            key,
                            String(value)
                        );
                    }
                }
            );

            /* -----------------------------------------
               FILE
            ----------------------------------------- */

            if (aadhaarFile) {
                body.append(
                    "aadhaar_card",
                    aadhaarFile
                );
            }

            /* -----------------------------------------
               DEBUG
               Remove after testing
            ----------------------------------------- */

            console.log(
                "========== FORM DATA =========="
            );

            for (const [
                key,
                value,
            ] of body.entries()) {
                console.log(
                    key,
                    value
                );
            }

            console.log(
                "PROGRAM ID:",
                formData.program_id
            );

            console.log(
                "==============================="
            );

            /* -----------------------------------------
               API REQUEST
            ----------------------------------------- */

            const res = await fetch(
                url,
                {
                    method:
                        isEdit
                            ? "PUT"
                            : "POST",

                    body,
                }
            );

            const data = await res.json();

            if (
                !res.ok ||
                !data.success
            ) {
                throw new Error(
                    data.message ||
                    "Something went wrong"
                );
            }

            /* -----------------------------------------
               EDIT SUCCESS
            ----------------------------------------- */

            if (isEdit) {
                alert(
                    "Player updated successfully"
                );

                router.push(
                    "/next_panel/admission-players"
                );

                router.refresh();

                return;
            }

            /* -----------------------------------------
               CREATE SUCCESS
            ----------------------------------------- */

            setCreatedAdmissionNo(
                data.data?.admission_no ||
                null
            );

        } catch (error) {
            console.error(
                "SUBMIT ERROR:",
                error
            );

            setError(
                error.message ||
                "Something went wrong"
            );

        } finally {
            setLoading(false);
        }
    };

    /* =====================================================
       POPUP CLOSE
    ===================================================== */

    const handlePopupClose = () => {
        setCreatedAdmissionNo(null);

        router.push(
            "/next_panel/admission-players"
        );

        router.refresh();
    };

    /* =====================================================
       ADD ANOTHER
    ===================================================== */

    const handleAddAnother = () => {
        setCreatedAdmissionNo(null);

        setFormData({
            ...EMPTY_FORM,
        });

        setAadhaarFile(null);
        setExistingAadhaarUrl(null);
        setPrograms([]);
        setError("");
    };

    /* =====================================================
       LOADING
    ===================================================== */

    if (
        fetching ||
        optionsLoading
    ) {
        return (
            <div className="text-center py-5">
                Loading...
            </div>
        );
    }

    /* =====================================================
       UI
    ===================================================== */

    return (
        <>
            {/* =================================================
                SUCCESS POPUP
            ================================================= */}

            {createdAdmissionNo && (
                <div
                    className="modal d-block"
                    tabIndex={-1}
                    style={{
                        backgroundColor:
                            "rgba(0,0,0,0.5)",
                    }}
                    role="dialog"
                >
                    <div className="modal-dialog modal-dialog-centered">
                        <div className="modal-content">

                            <div className="modal-body text-center p-4">

                                <h5 className="mb-3">
                                    Player Admitted Successfully
                                </h5>

                                <p className="text-muted mb-2">
                                    Admission Number
                                </p>

                                <div className="display-6 fw-bold text-primary mb-4">
                                    {createdAdmissionNo}
                                </div>

                                <div className="d-flex justify-content-center gap-2">

                                    <button
                                        type="button"
                                        className="btn btn-outline-secondary"
                                        onClick={
                                            handleAddAnother
                                        }
                                    >
                                        Add Another
                                    </button>

                                    <button
                                        type="button"
                                        className="btn btn-primary"
                                        onClick={
                                            handlePopupClose
                                        }
                                    >
                                        Go to List
                                    </button>

                                </div>

                            </div>

                        </div>
                    </div>
                </div>
            )}

            {/* =================================================
                FORM
            ================================================= */}

            <div className="card shadow-sm">

                <div className="card-header">
                    <h5 className="mb-0">
                        {isEdit
                            ? "Edit Admission Player"
                            : "Add Admission Player"}
                    </h5>
                </div>

                <div className="card-body">

                    {/* ERROR */}

                    {error && (
                        <div className="alert alert-danger">
                            {error}
                        </div>
                    )}

                    <form
                        onSubmit={handleSubmit}
                        encType="multipart/form-data"
                    >

                        {/* =====================================
                            ADMISSION NO / USER ID
                        ====================================== */}

                        <div className="row">

                            {isEdit && (
                                <div className="col-md-6 mb-3">
                                    <label className="form-label">
                                        Admission No
                                    </label>
                                    <input
                                        type="text"
                                        className="form-control"
                                        value={
                                            admissionNo
                                        }
                                        readOnly
                                        disabled
                                    />
                                    <div className="form-text">
                                        Auto-generated on creation
                                        — cannot be changed.
                                    </div>

                                </div>
                            )}

                            <div
                                className={
                                    isEdit
                                        ? "col-md-6 mb-3"
                                        : "col-md-12 mb-3"
                                }
                            >

                                <label className="form-label">
                                    User ID (optional)
                                </label>

                                <input
                                    type="text"
                                    name="user_id"
                                    className="form-control"
                                    value={
                                        formData.user_id
                                    }
                                    onChange={
                                        handleChange
                                    }
                                    placeholder="Linked user account ID, if any"
                                    disabled
                                    readOnly
                                />

                            </div>

                        </div>

                        {/* =====================================
                            NAME
                        ====================================== */}

                        <div className="row">

                            <div className="col-md-3 mb-3">

                                <label className="form-label">
                                    First Name
                                </label>

                                <input
                                    type="text"
                                    name="first_name"
                                    className="form-control"
                                    value={
                                        formData.first_name
                                    }
                                    onChange={
                                        handleChange
                                    }
                                    required
                                />

                            </div>

                            <div className="col-md-3 mb-3">

                                <label className="form-label">
                                    Last Name
                                </label>

                                <input
                                    type="text"
                                    name="last_name"
                                    className="form-control"
                                    value={
                                        formData.last_name
                                    }
                                    onChange={
                                        handleChange
                                    }
                                />

                            </div>

                            <div className="col-md-3 mb-3">

                                <label className="form-label">
                                    Father&apos;s Name
                                </label>

                                <input
                                    type="text"
                                    name="father_name"
                                    className="form-control"
                                    value={
                                        formData.father_name
                                    }
                                    onChange={
                                        handleChange
                                    }
                                />

                            </div>

                            <div className="col-md-3 mb-3">

                                <label className="form-label">
                                    Mother&apos;s Name
                                </label>

                                <input
                                    type="text"
                                    name="mother_name"
                                    className="form-control"
                                    value={
                                        formData.mother_name
                                    }
                                    onChange={
                                        handleChange
                                    }
                                />

                            </div>

                            <div className="col-md-3 mb-3">

                                <label className="form-label">
                                    Email
                                </label>

                                <input
                                    type="email"
                                    name="email"
                                    className="form-control"
                                    value={
                                        formData.email
                                    }
                                    onChange={
                                        handleChange
                                    }
                                />

                            </div>

                            <div className="col-md-3 mb-3">

                                <label className="form-label">
                                    Phone
                                </label>

                                <input
                                    type="text"
                                    name="phone"
                                    className="form-control"
                                    value={
                                        formData.phone
                                    }
                                    onChange={
                                        handleChange
                                    }
                                />

                            </div>

                            <div className="col-md-6 mb-3">

                                <label className="form-label">
                                    Address
                                </label>

                                <textarea
                                    name="address"
                                    className="form-control"
                                    rows={2}
                                    value={
                                        formData.address
                                    }
                                    onChange={
                                        handleChange
                                    }
                                />

                            </div>

                            <div className="col-md-3 mb-3">

                                <label className="form-label">
                                    City
                                </label>

                                <input
                                    type="text"
                                    name="city"
                                    className="form-control"
                                    value={
                                        formData.city
                                    }
                                    onChange={
                                        handleChange
                                    }
                                />

                            </div>

                            <div className="col-md-3 mb-3">

                                <label className="form-label">
                                    State
                                </label>

                                <input
                                    type="text"
                                    name="state"
                                    className="form-control"
                                    value={
                                        formData.state
                                    }
                                    onChange={
                                        handleChange
                                    }
                                />

                            </div>

                            <div className="col-md-3 mb-3">

                                <label className="form-label">
                                    Pin Code
                                </label>

                                <input
                                    type="text"
                                    name="pin_code"
                                    className="form-control"
                                    value={
                                        formData.pin_code
                                    }
                                    onChange={
                                        handleChange
                                    }
                                />

                            </div>

                            <div className="col-md-3 mb-3">

                                <label className="form-label">
                                    Gender
                                </label>

                                <select
                                    name="gender"
                                    className="form-select"
                                    value={
                                        formData.gender
                                    }
                                    onChange={
                                        handleChange
                                    }
                                >

                                    <option value="">
                                        Select Gender
                                    </option>

                                    <option value="male">
                                        Male
                                    </option>

                                    <option value="female">
                                        Female
                                    </option>

                                    <option value="other">
                                        Other
                                    </option>

                                </select>

                            </div>

                            <div className="col-md-3 mb-3">

                                <label className="form-label">
                                    Under Age
                                </label>

                                <select
                                    name="under_age"
                                    className="form-select"
                                    value={
                                        formData.under_age
                                    }
                                    onChange={
                                        handleChange
                                    }
                                >

                                    <option value={0}>
                                        No
                                    </option>

                                    <option value={1}>
                                        Yes
                                    </option>

                                </select>

                            </div>

                            <div className="col-md-3 mb-3">

                                <label className="form-label">
                                    Age Group
                                    (optional)
                                </label>

                                <select
                                    name="age_group_id"
                                    className="form-select"
                                    value={
                                        formData.age_group_id
                                    }
                                    onChange={
                                        handleChange
                                    }
                                >

                                    <option value="">
                                        Select Age Group
                                    </option>

                                    {ageGroups.map(
                                        (item) => (
                                            <option
                                                value={
                                                    item.id
                                                }
                                                key={
                                                    item.id
                                                }
                                            >
                                                {
                                                    item.age_group
                                                }
                                            </option>
                                        )
                                    )}

                                </select>

                            </div>

                            <div className="col-md-3 mb-3">

                                <label className="form-label">
                                    Status
                                </label>

                                <select
                                    name="status"
                                    className="form-select"
                                    value={
                                        formData.status
                                    }
                                    onChange={
                                        handleChange
                                    }
                                >

                                    <option value={1}>
                                        Active
                                    </option>

                                    <option value={0}>
                                        Inactive
                                    </option>

                                </select>

                            </div>

                            <div className="col-md-3 mb-3">

                                <label className="form-label">
                                    Branch
                                </label>

                                <select
                                    name="branch_id"
                                    className="form-select"
                                    value={
                                        formData.branch_id
                                    }
                                    onChange={
                                        handleChange
                                    }
                                    required
                                >

                                    <option value="">
                                        Select Branch
                                    </option>

                                    {branches
    .filter((br) => {

        // No academy assigned → show all branches
        if (!user.academy_id) {
            return true;
        }

        // Academy Admin → show all branches
        // of his academy
        if (user.user_type === "Academy Admin") {
            return (
                Number(br.academy_id) ===
                Number(user.academy_id)
            );
        }

        // Other users → academy + branch restriction
        return (
            Number(br.academy_id) ===
                Number(user.academy_id) &&
            Number(br.id) ===
                Number(user.branch_id)
        );
    })
    .map((branch) => (
        <option
            key={branch.id}
            value={branch.id}
        >
            {branch.branch_name}
        </option>
    ))}

                                </select>

                            </div>

                            <div className="col-md-3 mb-3">

                                <label className="form-label">
                                    Program
                                </label>

                                <select
                                    name="program_id"
                                    className="form-select"
                                    value={
                                        formData.program_id
                                    }
                                    onChange={
                                        handleChange
                                    }
                                    required
                                    disabled={
                                        !formData.branch_id ||
                                        programsLoading
                                    }
                                >

                                    <option value="">
                                        {!formData.branch_id
                                            ? "Select Branch First"
                                            : programsLoading
                                                ? "Loading Programs..."
                                                : "Select Program"}
                                    </option>

                                    {programs.map(
                                        (item) => (
                                            <option
                                                key={
                                                    item.id
                                                }
                                                value={
                                                    item.id
                                                }
                                            >
                                                {
                                                    item.program_name
                                                }
                                            </option>
                                        )
                                    )}

                                </select>

                                {String(formData.program_id) === "1" && (
                                    <div className="alert alert-info py-2 px-3 mt-2 mb-0 d-flex align-items-center gap-2 small">
                                        <Sparkles size={16} className="text-info flex-shrink-0" />
                                        <div>
                                            <strong>1:1 Individual Training:</strong> An individual coaching record will be automatically scheduled and synced for this player.
                                        </div>
                                    </div>
                                )}

                            </div>

                            <div className="col-md-3 mb-3">

                                <label className="form-label">
                                    Role
                                </label>

                                <select
                                    name="role_id"
                                    className="form-select"
                                    value={
                                        formData.role_id
                                    }
                                    onChange={
                                        handleChange
                                    }
                                    required
                                >

                                    <option value="">
                                        Select Role
                                    </option>

                                    {roles.map(
                                        (role) => (
                                            <option
                                                key={
                                                    role.id
                                                }
                                                value={
                                                    role.id
                                                }
                                            >
                                                {
                                                    role.role_name
                                                }
                                            </option>
                                        )
                                    )}

                                </select>

                            </div>

                            <div className="col-md-3 mb-3">

                                <label className="form-label">
                                    Aadhaar No
                                </label>

                                <input
                                    type="text"
                                    name="aadhaar_no"
                                    className="form-control"
                                    value={
                                        formData.aadhaar_no
                                    }
                                    onChange={
                                        handleChange
                                    }
                                />

                            </div>

                            <div className="col-md-3 mb-3">

                                <label className="form-label">
                                    Playing Academy
                                </label>

                                <input
                                    type="text"
                                    name="playing_academy"
                                    className="form-control"
                                    value={
                                        formData.playing_academy
                                    }
                                    onChange={
                                        handleChange
                                    }
                                />

                            </div>

                            <div className="col-md-12 mb-3">

                                <label className="form-label">
                                    Aadhaar Card
                                    (JPG, PNG, WEBP or PDF,
                                    max 5MB)
                                </label>

                                <input
                                    type="file"
                                    name="aadhaar_card"
                                    className="form-control"
                                    accept=".jpg,.jpeg,.png,.webp,.pdf"
                                    onChange={
                                        handleFileChange
                                    }
                                />

                                {existingAadhaarUrl &&
                                    !aadhaarFile && (
                                        <div className="mt-2">

                                            <a
                                                href={
                                                    existingAadhaarUrl
                                                }
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-decoration-underline"
                                            >
                                                View current
                                                uploaded file
                                            </a>

                                            <div className="form-text">
                                                Uploading a
                                                new file will
                                                replace this one.
                                            </div>

                                        </div>
                                    )}

                            </div>

                            {/* Program Fee & Initial Payment Section */}
                            {(() => {
                                const selProg = programs.find((p) => String(p.id) === String(formData.program_id));
                                const feeAmt = Number(selProg?.program_fee || 0);
                                const regAmt = Number(selProg?.registration_fee || 0);
                                const kitAmt = Number(selProg?.kit_fee || 0);
                                const totalAmt = feeAmt + regAmt + kitAmt;

                                return (
                                    <div className="col-md-12 mb-3">
                                        <div className="card bg-light border-0 p-3">
                                            <h6 className="fw-bold mb-2">Program Fee & Initial Payment (Optional)</h6>
                                            {selProg ? (
                                                <div className="small text-muted mb-3 d-flex flex-wrap gap-3">
                                                    <span>Program Fee: <strong>₹{feeAmt.toFixed(2)}</strong></span>
                                                    <span>Registration Fee: <strong>₹{regAmt.toFixed(2)}</strong></span>
                                                    {kitAmt > 0 && <span>Kit Fee: <strong>₹{kitAmt.toFixed(2)}</strong></span>}
                                                    <span className="text-primary">Total Expected: <strong>₹{totalAmt.toFixed(2)}</strong></span>
                                                </div>
                                            ) : (
                                                <p className="small text-muted mb-2">Select a branch and program above to view fee breakdown.</p>
                                            )}
                                            <div className="row g-2">
                                                <div className="col-md-3">
                                                    <label className="form-label small">Initial Paid Amount (₹)</label>
                                                    <input
                                                        type="number"
                                                        name="paid_amount"
                                                        min="0"
                                                        step="0.01"
                                                        className="form-control form-control-sm"
                                                        placeholder="0.00"
                                                        value={formData.paid_amount || ""}
                                                        onChange={handleChange}
                                                        disabled={loading}
                                                    />
                                                </div>
                                                <div className="col-md-3">
                                                    <label className="form-label small">Payment Mode</label>
                                                    <select
                                                        name="payment_mode"
                                                        className="form-select form-select-sm"
                                                        value={formData.payment_mode || "Cash"}
                                                        onChange={handleChange}
                                                        disabled={loading}
                                                    >
                                                        <option value="Cash">Cash</option>
                                                        <option value="UPI">UPI / QR</option>
                                                        <option value="Card">Card</option>
                                                        <option value="Bank Transfer">Bank Transfer</option>
                                                        <option value="Cheque">Cheque</option>
                                                    </select>
                                                </div>
                                                <div className="col-md-3">
                                                    <label className="form-label small">Transaction / Ref No</label>
                                                    <input
                                                        type="text"
                                                        name="transaction_no"
                                                        className="form-control form-control-sm"
                                                        placeholder="UPI / Cheque / Ref #"
                                                        value={formData.transaction_no || ""}
                                                        onChange={handleChange}
                                                        disabled={loading}
                                                    />
                                                </div>
                                                <div className="col-md-3">
                                                    <label className="form-label small">Payment Remarks</label>
                                                    <input
                                                        type="text"
                                                        name="payment_remarks"
                                                        className="form-control form-control-sm"
                                                        placeholder="Remarks"
                                                        value={formData.payment_remarks || ""}
                                                        onChange={handleChange}
                                                        disabled={loading}
                                                    />
                                                </div>
                                            </div>
                                            <div className="form-text mt-1 text-muted small">
                                                A monthly fee invoice and attendance record will be automatically generated upon admission.
                                            </div>
                                        </div>
                                    </div>
                                );
                            })()}
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
                                        ? "Update Player"
                                        : "Add Player"}
                            </button>

                            <button
                                type="button"
                                className="btn btn-secondary"
                                onClick={() =>
                                    router.push(
                                        "/next_panel/admission-players"
                                    )
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

