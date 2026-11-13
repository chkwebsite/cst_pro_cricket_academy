"use client";

import { ImagePlus, Building2, GitBranch } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useUser } from "../components/UserContext";

const ALLOWED_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
const MAX_IMAGE_MB = 2;

const EMPTY_FORM = {
    player_name: "",
    phone: "",
    email: "",
    date_of_birth: "",
    age_group_id: "",
    gender: "",
    batting_style: "",
    bowling_style: "",
    address: "",
    status: 1,
};

export default function OutsidePlayerForm({ id = null, embedded = false, onCreated, onCancel }) {
    const router = useRouter();
    const isEdit = Boolean(id);
    const { user } = useUser();

    const [formData, setFormData] = useState(EMPTY_FORM);
    const [academyId, setAcademyId] = useState("");
    const [branchId, setBranchId] = useState("");
    const [academies, setAcademies] = useState([]);
    const [branches, setBranches] = useState([]);
    const [ageGroups, setAgeGroups] = useState([]);
    const [imageFile, setImageFile] = useState(null);
    const [preview, setPreview] = useState("");
    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(false);
    const [error, setError] = useState("");

    const isSuperAdmin = !user?.academy_id || user?.user_type === "Super Admin";
    const isAcademyAdmin = user?.user_type === "Academy Admin";
    const isBranchAdmin = user?.user_type === "Branch Admin" || (!isSuperAdmin && !isAcademyAdmin && Boolean(user?.branch_id));

    // Auto-populate academy & branch from logged-in user in Add mode
    useEffect(() => {
        if (isEdit || !user) return;

        if (user.academy_id && !academyId) {
            setAcademyId(String(user.academy_id));
        }
        if (user.branch_id && !branchId) {
            setBranchId(String(user.branch_id));
        }
    }, [user, isEdit]);

    // Load academies for dropdown / labels
    useEffect(() => {
        let isMounted = true;
        const fetchAcademies = async () => {
            try {
                const res = await fetch("/api/academies");
                const json = await res.json();
                if (isMounted && res.ok && json.success) {
                    setAcademies(json.data || []);
                }
            } catch (err) {
                console.error("Failed to fetch academies:", err);
            }
        };
        fetchAcademies();
        return () => { isMounted = false; };
    }, []);

    // Load branches when academyId changes
    useEffect(() => {
        const targetAcad = academyId || user?.academy_id;
        if (!targetAcad) {
            setBranches([]);
            return;
        }

        let isMounted = true;
        const fetchBranches = async () => {
            try {
                const res = await fetch(`/api/branch?academy_id=${targetAcad}`);
                const json = await res.json();
                if (isMounted && res.ok && json.success) {
                    setBranches(json.data || []);
                }
            } catch (err) {
                console.error("Failed to fetch branches:", err);
            }
        };
        fetchBranches();
        return () => { isMounted = false; };
    }, [academyId, user?.academy_id]);

    // Load age groups
    useEffect(() => {
        const getAgeGroups = async () => {
            try {
                const res = await fetch("/api/age-groups");
                const result = await res.json();

                if (!res.ok || !result.success) {
                    throw new Error(result.message || "Failed to fetch age groups");
                }

                setAgeGroups(result.data || []);
            } catch (err) {
                setError(err.message);
            }
        };

        getAgeGroups();
    }, []);

    // GET SINGLE OUTSIDE PLAYER (edit mode)
    useEffect(() => {
        if (!id) return;

        const getPlayer = async () => {
            try {
                setFetching(true);
                setError("");
                const res = await fetch(`/api/outside-players/${id}`);
                const result = await res.json();

                if (!res.ok || !result.success) {
                    throw new Error(result.message || "Failed to fetch Outside Player");
                }

                const d = result.data;
                setAcademyId(d.academy_id ? String(d.academy_id) : "");
                setBranchId(d.branch_id ? String(d.branch_id) : "");
                setFormData({
                    player_name: d.player_name || "",
                    phone: d.phone || "",
                    email: d.email || "",
                    date_of_birth: d.date_of_birth ? String(d.date_of_birth).slice(0, 10) : "",
                    age_group_id: d.age_group_id ?? "",
                    gender: d.gender || "",
                    batting_style: d.batting_style || "",
                    bowling_style: d.bowling_style || "",
                    address: d.address || "",
                    status: d.status ?? 1,
                });
                setPreview(d.profile_image || "");
            } catch (err) {
                setError(err.message);
            } finally {
                setFetching(false);
            }
        };
        getPlayer();
    }, [id]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData((prev) => ({
            ...prev,
            [name]: name === "status" ? Number(value) : value,
        }));
    };

    // IMAGE PICK (same rules as the API: jpg / jpeg / png / webp)
    const handleImageChange = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!ALLOWED_TYPES.includes(file.type)) {
            e.target.value = "";
            return setError("Only JPG, JPEG, PNG and WEBP images are allowed");
        }
        if (file.size > MAX_IMAGE_MB * 1024 * 1024) {
            e.target.value = "";
            return setError(`Image must be smaller than ${MAX_IMAGE_MB} MB`);
        }

        setError("");
        setImageFile(file);
        setPreview(URL.createObjectURL(file));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        // Validation
        if (!formData.player_name.trim()) return setError("Player name is required");
        if (formData.email.trim() && !/^\S+@\S+\.\S+$/.test(formData.email.trim())) {
            return setError("Please enter a valid email address");
        }

        const effectiveAcademyId = academyId || user?.academy_id;
        if (!effectiveAcademyId && isSuperAdmin) {
            return setError("Please select an academy");
        }

        try {
            setLoading(true);
            setError("");

            const body = new FormData();
            Object.entries(formData).forEach(([key, value]) => {
                body.append(key, typeof value === "string" ? value.trim() : value);
            });

            // Append academy_id and branch_id
            if (effectiveAcademyId) {
                body.append("academy_id", effectiveAcademyId);
            }
            const effectiveBranchId = branchId || (isBranchAdmin ? user?.branch_id : null);
            if (effectiveBranchId) {
                body.append("branch_id", effectiveBranchId);
            }

            if (imageFile) body.append("profile_image", imageFile);

            const res = await fetch(isEdit ? `/api/outside-players/${id}` : `/api/outside-players`, {
                method: isEdit ? "PUT" : "POST",
                body,
            });

            const data = await res.json();

            if (!res.ok || !data.success) {
                throw new Error(data.message || "Something went wrong");
            }

            if (embedded && !isEdit) {
                onCreated?.({
                    ...data.data,
                    player_name: formData.player_name.trim(),
                    email: formData.email.trim(),
                    academy_id: effectiveAcademyId,
                    branch_id: effectiveBranchId,
                });
                return;
            }

            alert(isEdit ? "Outside player updated successfully" : "Outside player added successfully");

            router.push("/next_panel/outside-players");
            router.refresh();
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    if (fetching) {
        return <div className="text-center py-5">Loading...</div>;
    }

    const currentAcademyName =
        user?.academy_name ||
        academies.find((a) => Number(a.id) === Number(academyId || user?.academy_id))?.academy_name ||
        "CST Pro Cricket Academy";

    const currentBranchName =
        user?.branch_name ||
        branches.find((b) => Number(b.id) === Number(branchId || user?.branch_id))?.branch_name ||
        "Main Branch";

    return (
        <div className={embedded ? "" : "card shadow-sm"}>
            {!embedded && (
                <div className="card-header">
                    <h5 className="mb-0">{isEdit ? "Edit Outside Player" : "Add Outside Player"}</h5>
                </div>
            )}

            <div className={embedded ? "" : "card-body"}>
                {error && <div className="alert alert-danger">{error}</div>}

                <form onSubmit={handleSubmit}>
                    {/* Academy & Branch Selection / Auto-filled Display */}
                    <div className="row mb-3 p-3 bg-light rounded-3 border">
                        {isSuperAdmin ? (
                            <>
                                <div className="col-md-6 mb-2 mb-md-0">
                                    <label className="form-label fw-semibold">
                                        <Building2 size={16} className="me-1 text-primary" />
                                        Academy <span className="text-danger">*</span>
                                    </label>
                                    <select
                                        className="form-select"
                                        value={academyId}
                                        onChange={(e) => {
                                            setAcademyId(e.target.value);
                                            setBranchId("");
                                        }}
                                        required
                                    >
                                        <option value="">Select Academy</option>
                                        {academies.map((a) => (
                                            <option key={a.id} value={a.id}>
                                                {a.academy_name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div className="col-md-6">
                                    <label className="form-label fw-semibold">
                                        <GitBranch size={16} className="me-1 text-primary" />
                                        Branch (optional)
                                    </label>
                                    <select
                                        className="form-select"
                                        value={branchId}
                                        onChange={(e) => setBranchId(e.target.value)}
                                        disabled={!academyId}
                                    >
                                        <option value="">Select Branch (All / Main)</option>
                                        {branches.map((b) => (
                                            <option key={b.id} value={b.id}>
                                                {b.branch_name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </>
                        ) : isAcademyAdmin ? (
                            <>
                                <div className="col-md-6 mb-2 mb-md-0">
                                    <label className="form-label fw-semibold">
                                        <Building2 size={16} className="me-1 text-primary" />
                                        Academy (Auto Assigned)
                                    </label>
                                    <input
                                        type="text"
                                        className="form-control bg-white"
                                        value={currentAcademyName}
                                        readOnly
                                        disabled
                                    />
                                </div>
                                <div className="col-md-6">
                                    <label className="form-label fw-semibold">
                                        <GitBranch size={16} className="me-1 text-primary" />
                                        Branch (optional)
                                    </label>
                                    <select
                                        className="form-select"
                                        value={branchId}
                                        onChange={(e) => setBranchId(e.target.value)}
                                    >
                                        <option value="">Select Branch (All / Main)</option>
                                        {branches.map((b) => (
                                            <option key={b.id} value={b.id}>
                                                {b.branch_name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </>
                        ) : (
                            /* Branch Admin / Staff: both auto-filled */
                            <>
                                <div className="col-md-6 mb-2 mb-md-0">
                                    <label className="form-label fw-semibold">
                                        <Building2 size={16} className="me-1 text-primary" />
                                        Academy (Auto Assigned)
                                    </label>
                                    <input
                                        type="text"
                                        className="form-control bg-white"
                                        value={currentAcademyName}
                                        readOnly
                                        disabled
                                    />
                                </div>
                                <div className="col-md-6">
                                    <label className="form-label fw-semibold">
                                        <GitBranch size={16} className="me-1 text-primary" />
                                        Branch (Auto Assigned)
                                    </label>
                                    <input
                                        type="text"
                                        className="form-control bg-white"
                                        value={currentBranchName}
                                        readOnly
                                        disabled
                                    />
                                </div>
                            </>
                        )}
                    </div>

                    {/* Profile image */}
                    <div className="mb-3">
                        <label className="form-label">Profile Image (optional)</label>
                        <div className="d-flex align-items-center gap-3">
                            {preview ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                    src={preview}
                                    alt="Profile preview"
                                    className="rounded-circle border"
                                    style={{ width: 72, height: 72, objectFit: "cover" }}
                                />
                            ) : (
                                <div
                                    className="rounded-circle border bg-light d-flex align-items-center justify-content-center text-muted"
                                    style={{ width: 72, height: 72 }}
                                >
                                    <ImagePlus size={24} />
                                </div>
                            )}
                            <input
                                type="file"
                                name="profile_image"
                                className="form-control"
                                style={{ maxWidth: 320 }}
                                accept="image/jpeg,image/png,image/webp"
                                onChange={handleImageChange}
                            />
                        </div>
                        <div className="form-text">JPG, PNG or WEBP, up to {MAX_IMAGE_MB} MB.</div>
                    </div>

                    <div className="row">
                        <div className="col-md-4 mb-3">
                            <label className="form-label">Player Name <span className="text-danger">*</span></label>
                            <input
                                type="text"
                                name="player_name"
                                className="form-control"
                                value={formData.player_name}
                                onChange={handleChange}
                                placeholder="Enter player name"
                                required
                            />
                        </div>

                        <div className="col-md-4 mb-3">
                            <label className="form-label">Date of Birth (optional)</label>
                            <input
                                type="date"
                                name="date_of_birth"
                                className="form-control"
                                value={formData.date_of_birth}
                                onChange={handleChange}
                            />
                        </div>

                        <div className="col-md-4 mb-3">
                            <label className="form-label">Age Group (optional)</label>
                            <select
                                name="age_group_id"
                                className="form-select"
                                value={formData.age_group_id}
                                onChange={handleChange}
                            >
                                <option value="">Select Age Group</option>
                                {ageGroups.map((item) => (
                                    <option value={item.id} key={item.id}>
                                        {item.age_group}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="row">
                        <div className="col-md-4 mb-3">
                            <label className="form-label">Phone (optional)</label>
                            <input
                                type="tel"
                                name="phone"
                                className="form-control"
                                value={formData.phone}
                                onChange={handleChange}
                                placeholder="Enter phone number"
                            />
                        </div>

                        <div className="col-md-4 mb-3">
                            <label className="form-label">Email (optional)</label>
                            <input
                                type="email"
                                name="email"
                                className="form-control"
                                value={formData.email}
                                onChange={handleChange}
                                placeholder="Enter email"
                            />
                        </div>

                        <div className="col-md-4 mb-3">
                            <label className="form-label">Gender (optional)</label>
                            <select
                                name="gender"
                                className="form-select"
                                value={formData.gender}
                                onChange={handleChange}
                            >
                                <option value="">Choose Gender</option>
                                <option value="Male">Male</option>
                                <option value="Female">Female</option>
                                <option value="Other">Other</option>
                            </select>
                        </div>
                    </div>

                    <div className="row">
                        <div className="col-md-6 mb-3">
                            <label className="form-label">Batting Style (optional)</label>
                            <select
                                name="batting_style"
                                className="form-select"
                                value={formData.batting_style}
                                onChange={handleChange}
                            >
                                <option value="">Choose Batting Style</option>
                                <option value="Right-hand batter">Right-hand batter</option>
                                <option value="Left-hand batter">Left-hand batter</option>
                            </select>
                        </div>

                        <div className="col-md-6 mb-3">
                            <label className="form-label">Bowling Style (optional)</label>
                            <input
                                type="text"
                                name="bowling_style"
                                className="form-control"
                                list="bowling-styles"
                                value={formData.bowling_style}
                                onChange={handleChange}
                                placeholder="e.g. Right-arm off break"
                            />
                            <datalist id="bowling-styles">
                                <option value="Right-arm fast" />
                                <option value="Right-arm medium" />
                                <option value="Right-arm off break" />
                                <option value="Right-arm leg break" />
                                <option value="Left-arm fast" />
                                <option value="Left-arm medium" />
                                <option value="Left-arm orthodox" />
                                <option value="Left-arm chinaman" />
                            </datalist>
                        </div>
                    </div>

                    <div className="mb-3">
                        <label className="form-label">Address (optional)</label>
                        <textarea
                            name="address"
                            className="form-control"
                            rows={2}
                            value={formData.address}
                            onChange={handleChange}
                            placeholder="Enter full address"
                        />
                    </div>

                    <div className="mb-3">
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

                    <div className="d-flex gap-2">
                        <button type="submit" className="btn btn-primary" disabled={loading}>
                            {loading ? "Saving..." : isEdit ? "Update Player" : "Add Player"}
                        </button>
                        <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={() => (embedded ? onCancel?.() : router.push("/next_panel/outside-players"))}
                        >
                            {embedded ? "Close" : "Cancel"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
