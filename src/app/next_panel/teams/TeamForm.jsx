"use client";

import { useRouter } from "next/navigation";
import { RefreshCw, Building2, GitBranch } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import useCurrentUser, { ROLES } from "./useCurrentUser";
import useOrgOptions, { inAcademy } from "./useOrgOptions";
import { FormError } from "@/app/components/form";

export const TEAM_TYPES = ["Academy", "External", "Club", "School", "Corporate", "Other"];
const TEAM_CODE_PREFIX = "TEAM-CODE-";

const EMPTY_FORM = {
    academy_id: "",
    branch_id: "",
    team_name: "",
    team_code: "",
    team_type: "Academy",
    category: "",
    age_group: "",
    status: 1,
};

export default function TeamForm({ id = null, returnTo = "/next_panel/teams" }) {
    const router = useRouter();
    const isEdit = Boolean(id);

    const me = useCurrentUser();
    const { academies, branches, error: orgError } = useOrgOptions(me);
    const isSuper = me.role === ROLES.SUPER;
    const isAcademyAdmin = me.role === ROLES.ACADEMY;
    const isBranchAdmin = me.role === ROLES.BRANCH;
    const blocked = me.ready && (!me.role || (!isSuper && !me.academyId) || (isBranchAdmin && !me.branchId));

    const [formData, setFormData] = useState(EMPTY_FORM);
    const [ageGroups, setAgeGroups] = useState([]);
    const [existingTeams, setExistingTeams] = useState([]);
    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(false);
    const [generatingCode, setGeneratingCode] = useState(false);
    const [forbidden, setForbidden] = useState(false);
    const [error, setError] = useState("");
    const [fieldErrors, setFieldErrors] = useState({});

    const currentAcademyId = isSuper ? formData.academy_id : me.academyId;
    const currentBranchId = isBranchAdmin ? me.branchId : (formData.branch_id || null);

    // Fetch existing teams in academy to check duplicates in real-time
    useEffect(() => {
        if (!currentAcademyId) {
            setExistingTeams([]);
            return;
        }
        const controller = new AbortController();
        (async () => {
            try {
                const res = await fetch(`/api/teams?academy_id=${currentAcademyId}`, {
                    signal: controller.signal,
                });
                const json = await res.json();
                if (res.ok && json.success) {
                    setExistingTeams(json.data || []);
                }
            } catch {
                /* ignore */
            }
        })();
        return () => controller.abort();
    }, [currentAcademyId]);

    const isDuplicateTeamName = useMemo(() => {
        const trimmed = formData.team_name.trim().toLowerCase();
        if (!trimmed) return false;
        const currentBranch = String(currentBranchId || "");
        return existingTeams.some((t) => {
            if (id && Number(t.id) === Number(id)) return false;
            const sameName = String(t.team_name || "").trim().toLowerCase() === trimmed;
            const tBranch = String(t.branch_id || "");
            const sameBranch = (tBranch === "" && currentBranch === "") || tBranch === currentBranch;
            return sameName && sameBranch;
        });
    }, [formData.team_name, currentBranchId, existingTeams, id]);

    // Age-group suggestions (optional - teams.age_group is free text)
    useEffect(() => {
        const controller = new AbortController();
        (async () => {
            try {
                const res = await fetch("/api/age-groups", { signal: controller.signal });
                const json = await res.json();
                if (res.ok && json.success) setAgeGroups(json.data || []);
            } catch {
                /* suggestions only - ignore */
            }
        })();
        return () => controller.abort();
    }, []);

    // CREATE: academy / branch admins get their own academy (and branch) pre-filled
    useEffect(() => {
        if (isEdit || !me.ready || blocked || isSuper) return;
        setFormData((prev) => ({
            ...prev,
            academy_id: me.academyId ? String(me.academyId) : "",
            branch_id: isBranchAdmin ? (me.branchId ? String(me.branchId) : "") : prev.branch_id,
        }));
    }, [isEdit, me.ready, blocked, isSuper, isBranchAdmin, me.academyId, me.branchId]);

    // GET SINGLE TEAM (edit mode)
    useEffect(() => {
        if (!id || !me.ready || blocked) return;

        const getTeam = async () => {
            try {
                setFetching(true);
                setError("");
                const res = await fetch(`/api/teams/${id}`);
                const result = await res.json();

                if (!res.ok || !result.success) {
                    throw new Error(result.message || "Failed to fetch Team");
                }

                const d = result.data;

                // UX guard: scoped roles can only open teams they are allowed to manage
                if (!isSuper && Number(d.academy_id) !== Number(me.academyId)) return setForbidden(true);
                if (isBranchAdmin && Number(d.branch_id) !== Number(me.branchId)) return setForbidden(true);

                setFormData({
                    academy_id: d.academy_id ? String(d.academy_id) : "",
                    branch_id: d.branch_id ? String(d.branch_id) : "",
                    team_name: d.team_name || "",
                    team_code: d.team_code || "",
                    team_type: d.team_type || "Academy",
                    category: d.category || "",
                    age_group: d.age_group || "",
                    status: d.status ?? 1,
                });
            } catch (err) {
                setError(err.message);
            } finally {
                setFetching(false);
            }
        };
        getTeam();
    }, [id, me.ready, blocked, isSuper, isBranchAdmin, me.academyId, me.branchId]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData((prev) => ({
            ...prev,
            [name]: name === "status" ? Number(value) : value,
            ...(name === "academy_id" ? { branch_id: "" } : {}),
        }));
        if (fieldErrors[name]) {
            setFieldErrors((prev) => {
                const next = { ...prev };
                delete next[name];
                return next;
            });
        }
    };

    const handleBlur = (field) => () => {
        let err = null;
        if (field === "team_name") {
            if (!formData.team_name.trim()) err = "Team name is required.";
            else if (isDuplicateTeamName) err = "A team with this name already exists in the selected academy and branch.";
        }
        if (field === "academy_id" && isSuper && !formData.academy_id) err = "Please select an academy.";
        if (field === "team_type" && !formData.team_type) err = "Please select a team type.";
        if (err) setFieldErrors((prev) => ({ ...prev, [field]: err }));
    };

    const validateAll = () => {
        const errors = {};
        if (!formData.team_name.trim()) errors.team_name = "Team name is required.";
        if (isDuplicateTeamName) {
            errors.team_name = "A team with this name already exists in the selected academy and branch.";
        }
        const effectiveAcademyId = isSuper ? formData.academy_id : me.academyId;
        if (!effectiveAcademyId && isSuper) {
            errors.academy_id = "Please select an academy.";
        }
        if (!formData.team_type) {
            errors.team_type = "Please select a team type.";
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

    const handleGenerateCode = async () => {
        try {
            setGeneratingCode(true);
            setError("");

            const effectiveAcademy = isSuper ? formData.academy_id : me.academyId;
            const params = new URLSearchParams();
            if (effectiveAcademy) params.set("academy_id", effectiveAcademy);

            const query = params.toString();
            const res = await fetch(`/api/teams${query ? `?${query}` : ""}`);
            const json = await res.json();

            if (!res.ok || !json.success) {
                throw new Error(json.message || "Unable to generate team code");
            }

            const academyTeams = (json.data || []).filter(
                (team) => String(team.academy_id || "") === String(effectiveAcademy || "")
            );
            const pattern = /^TEAM-CODE-(\d+)$/i;
            const maxNumber = academyTeams.reduce((max, team) => {
                const match = pattern.exec(team.team_code || "");
                return match ? Math.max(max, Number(match[1])) : max;
            }, 0);

            const teamCode = `${TEAM_CODE_PREFIX}${String(maxNumber + 1).padStart(3, "0")}`;
            setFormData((prev) => ({ ...prev, team_code: teamCode }));
        } catch (err) {
            setError(err.message);
        } finally {
            setGeneratingCode(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!validateAll()) return;

        const effectiveAcademyId = isSuper ? formData.academy_id : me.academyId;
        const effectiveBranchId = isBranchAdmin ? me.branchId : (formData.branch_id || null);

        try {
            setLoading(true);
            setError("");

            const res = await fetch(isEdit ? `/api/teams/${id}` : `/api/teams`, {
                method: isEdit ? "PUT" : "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    academy_id: effectiveAcademyId ? Number(effectiveAcademyId) : null,
                    branch_id: effectiveBranchId ? Number(effectiveBranchId) : null,
                    team_name: formData.team_name.trim(),
                    team_code: formData.team_code.trim() || null,
                    team_type: formData.team_type,
                    category: formData.category.trim() || null,
                    age_group: formData.age_group.trim() || null,
                    status: formData.status,
                    ...(!isEdit && me.id ? { created_by: me.id } : {}),
                }),
            });

            const data = await res.json();

            if (!res.ok || !data.success) {
                if (data.errors) {
                    setFieldErrors(data.errors);
                }
                throw new Error(data.message || "Something went wrong");
            }

            alert(isEdit ? "Team updated successfully" : "Team added successfully");

            router.push(returnTo);
            router.refresh();
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    if (!me.ready || fetching) {
        return <div className="text-center py-5">Loading...</div>;
    }

    if (blocked) {
        return <div className="alert alert-warning">Unable to determine your role / academy / branch. Please log in again.</div>;
    }

    if (forbidden) {
        return <div className="alert alert-danger">You do not have access to this team.</div>;
    }

    const branchOptions = currentAcademyId
        ? branches.filter((b) => inAcademy(b, currentAcademyId))
        : [];

    const currentAcademyName =
        me.academyName ||
        academies.find((a) => Number(a.id) === Number(currentAcademyId))?.academy_name ||
        "CST Pro Cricket Academy";

    const currentBranchName =
        me.branchName ||
        branches.find((b) => Number(b.id) === Number(formData.branch_id || me.branchId))?.branch_name ||
        "Main Branch";

    return (
        <div className="card shadow-sm">
            <div className="card-header">
                <h5 className="mb-0">{isEdit ? "Edit Team" : "Add Team"}</h5>
            </div>

            <div className="card-body">
                {(error || orgError) && <div className="alert alert-danger">{error || orgError}</div>}

                <form onSubmit={handleSubmit} noValidate>
                    {/* Academy & Branch Selection / Auto-filled Display */}
                    <div className="row mb-3 p-3 bg-light rounded-3 border">
                        {isSuper ? (
                            <>
                                <div className="col-md-6 mb-2 mb-md-0">
                                    <label className="form-label fw-semibold" htmlFor="academy_id">
                                        <Building2 size={16} className="me-1 text-primary" />
                                        Academy <span className="text-danger ms-1">*</span>
                                    </label>
                                    <select
                                        id="academy_id"
                                        name="academy_id"
                                        className={`form-select ${fieldErrors.academy_id ? "is-invalid border-danger" : ""}`}
                                        value={formData.academy_id}
                                        onChange={handleChange}
                                        onBlur={handleBlur("academy_id")}
                                    >
                                        <option value="">Select Academy</option>
                                        {academies.map((a) => (
                                            <option key={a.id} value={a.id}>
                                                {a.academy_name}
                                            </option>
                                        ))}
                                    </select>
                                    <FormError error={fieldErrors.academy_id} />
                                </div>

                                <div className="col-md-6">
                                    <label className="form-label fw-semibold">
                                        <GitBranch size={16} className="me-1 text-primary" />
                                        Branch
                                    </label>
                                    <select
                                        name="branch_id"
                                        className="form-select"
                                        value={formData.branch_id}
                                        onChange={handleChange}
                                        disabled={!formData.academy_id}
                                    >
                                        <option value="">
                                            {formData.academy_id ? "No branch (All / Main Branch)" : "Choose academy first"}
                                        </option>
                                        {branchOptions.map((b) => (
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
                                    <input type="hidden" name="academy_id" value={me.academyId} />
                                </div>

                                <div className="col-md-6">
                                    <label className="form-label fw-semibold">
                                        <GitBranch size={16} className="me-1 text-primary" />
                                        Branch
                                    </label>
                                    <select
                                        name="branch_id"
                                        className="form-select"
                                        value={formData.branch_id}
                                        onChange={handleChange}
                                    >
                                        <option value="">All / Main Branch</option>
                                        {branchOptions.map((b) => (
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
                                    <input type="hidden" name="academy_id" value={me.academyId} />
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
                                    <input type="hidden" name="branch_id" value={me.branchId} />
                                </div>
                            </>
                        )}
                    </div>

                    <div className="row">
                        <div className="col-md-6 mb-3">
                            <label className="form-label" htmlFor="team_name">Team Name <span className="text-danger ms-1">*</span></label>
                            <input
                                id="team_name"
                                type="text"
                                name="team_name"
                                className={`form-control ${fieldErrors.team_name || isDuplicateTeamName ? "is-invalid border-danger" : ""}`}
                                value={formData.team_name}
                                onChange={handleChange}
                                onBlur={handleBlur("team_name")}
                                placeholder="Enter team name"
                            />
                            <FormError error={fieldErrors.team_name || (isDuplicateTeamName ? "A team with this name already exists in the selected academy and branch." : null)} />
                        </div>

                        <div className="col-md-6 mb-3">
                            <label className="form-label">Team Code</label>
                            <div className="input-group">
                                <input
                                    type="text"
                                    name="team_code"
                                    className="form-control"
                                    value={formData.team_code}
                                    onChange={handleChange}
                                    placeholder="e.g. WAR-U19"
                                />
                                <button
                                    type="button"
                                    className="btn btn-outline-primary"
                                    onClick={handleGenerateCode}
                                    disabled={generatingCode}
                                >
                                    <RefreshCw size={16} className="me-1" />
                                    {generatingCode ? "Generating..." : "Generate"}
                                </button>
                            </div>
                            <div className="form-text">Saved in uppercase; must be unique within the academy.</div>
                        </div>
                    </div>

                    <div className="row">
                        <div className="col-md-4 mb-3">
                            <label className="form-label">Team Type</label>
                            <select name="team_type" className="form-select" value={formData.team_type} onChange={handleChange}>
                                {TEAM_TYPES.map((t) => (
                                    <option key={t} value={t}>{t}</option>
                                ))}
                            </select>
                        </div>

                        <div className="col-md-4 mb-3">
                            <label className="form-label">Category</label>
                            <input
                                type="text"
                                name="category"
                                className="form-control"
                                value={formData.category}
                                onChange={handleChange}
                                placeholder="e.g. Senior / Junior / Club"
                            />
                        </div>

                        <div className="col-md-4 mb-3">
                            <label className="form-label">Age Group</label>
                            <input
                                type="text"
                                name="age_group"
                                className="form-control"
                                list="age-groups-datalist"
                                value={formData.age_group}
                                onChange={handleChange}
                                placeholder="e.g. Under-19"
                            />
                            {ageGroups.length > 0 && (
                                <datalist id="age-groups-datalist">
                                    {ageGroups.map((a) => (
                                        <option key={a.id} value={a.age_group} />
                                    ))}
                                </datalist>
                            )}
                        </div>
                    </div>

                    <div className="mb-3">
                        <label className="form-label">Status</label>
                        <select name="status" className="form-select" value={formData.status} onChange={handleChange}>
                            <option value={1}>Active</option>
                            <option value={0}>Inactive</option>
                        </select>
                    </div>

                    <div className="d-flex gap-2">
                        <button type="submit" className="btn btn-primary" disabled={loading || isDuplicateTeamName}>
                            {loading ? "Saving..." : isEdit ? "Update Team" : "Add Team"}
                        </button>
                        <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={() => router.push(returnTo)}
                        >
                            Cancel
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
