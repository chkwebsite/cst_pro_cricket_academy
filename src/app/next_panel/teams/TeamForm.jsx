"use client";

import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import useCurrentUser, { ROLES } from "./useCurrentUser";
import useOrgOptions, { inAcademy } from "./useOrgOptions";

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
    const isBranchAdmin = me.role === ROLES.BRANCH;
    const blocked = me.ready && (!me.role || (!isSuper && !me.academyId) || (isBranchAdmin && !me.branchId));

    const [formData, setFormData] = useState(EMPTY_FORM);
    const [ageGroups, setAgeGroups] = useState([]);
    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(false);
    const [generatingCode, setGeneratingCode] = useState(false);
    const [forbidden, setForbidden] = useState(false);
    const [error, setError] = useState("");

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
            academy_id: me.academyId,
            branch_id: isBranchAdmin ? me.branchId : prev.branch_id,
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
                    academy_id: d.academy_id ?? "",
                    branch_id: d.branch_id ?? "",
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
            // changing academy invalidates the chosen branch
            ...(name === "academy_id" ? { branch_id: "" } : {}),
        }));
    };

    const handleGenerateCode = async () => {
        try {
            setGeneratingCode(true);
            setError("");

            const params = new URLSearchParams();
            const academyId = formData.team_type === "Academy" ? formData.academy_id : "";
            if (academyId) params.set("academy_id", academyId);

            const query = params.toString();
            const res = await fetch(`/api/teams${query ? `?${query}` : ""}`);
            const json = await res.json();

            if (!res.ok || !json.success) {
                throw new Error(json.message || "Unable to generate team code");
            }

            const academyTeams = (json.data || []).filter(
                (team) => String(team.academy_id || "") === String(academyId || "")
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

        if (!formData.team_name.trim()) return setError("Team name is required");

        // Non-academy team types are not linked to an academy or branch.
        const isAcademyTeam = formData.team_type === "Academy";
        const academy_id = isAcademyTeam
            ? isSuper ? formData.academy_id : me.academyId
            : null;
        const branch_id = isAcademyTeam
            ? isBranchAdmin ? me.branchId : formData.branch_id
            : null;

        try {
            setLoading(true);
            setError("");

            const res = await fetch(isEdit ? `/api/teams/${id}` : `/api/teams`, {
                method: isEdit ? "PUT" : "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    academy_id: academy_id || null,
                    branch_id: branch_id || null,
                    team_name: formData.team_name.trim(),
                    team_code: formData.team_code.trim() || null,
                    team_type: formData.team_type,
                    category: formData.category.trim() || null,
                    age_group: formData.age_group.trim() || null,
                    status: formData.status,
                    // only on create - on edit the API keeps the original creator
                    ...(!isEdit && me.id ? { created_by: me.id } : {}),
                }),
            });

            const data = await res.json();

            if (!res.ok || !data.success) {
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

    const isAcademyTeam = formData.team_type === "Academy";
    const branchOptions = formData.academy_id
        ? branches.filter((b) => inAcademy(b, formData.academy_id))
        : [];

    return (
        <div className="card shadow-sm">
            <div className="card-header">
                <h5 className="mb-0">{isEdit ? "Edit Team" : "Add Team"}</h5>
            </div>

            <div className="card-body">
                {(error || orgError) && <div className="alert alert-danger">{error || orgError}</div>}

                <form onSubmit={handleSubmit}>
                    {isAcademyTeam && <div className="row">
                        <div className="col-md-6 mb-3">
                            <label className="form-label">Academy</label>
                            <select
                                name="academy_id"
                                className="form-select"
                                value={formData.academy_id}
                                onChange={handleChange}
                                disabled={!isSuper}
                            >
                                <option value="">{isSuper ? "No academy (external team)" : "Choose Academy"}</option>
                                {academies.map((a) => (
                                    <option key={a.id} value={a.id}>{a.academy_name}</option>
                                ))}
                            </select>
                            {!isSuper && <div className="form-text">Locked to your academy.</div>}
                        </div>

                        <div className="col-md-6 mb-3">
                            <label className="form-label">Branch (optional)</label>
                            <select
                                name="branch_id"
                                className="form-select"
                                value={formData.branch_id}
                                onChange={handleChange}
                                disabled={isBranchAdmin || !formData.academy_id}
                            >
                                <option value="">
                                    {formData.academy_id ? "No branch (academy-level team)" : "Choose academy first"}
                                </option>
                                {branchOptions.map((b) => (
                                    <option key={b.id} value={b.id}>{b.branch_name}</option>
                                ))}
                            </select>
                            {isBranchAdmin && <div className="form-text">Locked to your branch.</div>}
                        </div>
                    </div>}

                    <div className="row">
                        <div className="col-md-6 mb-3">
                            <label className="form-label">Team Name</label>
                            <input
                                type="text"
                                name="team_name"
                                className="form-control"
                                value={formData.team_name}
                                onChange={handleChange}
                                placeholder="Enter team name"
                                required
                            />
                        </div>

                        <div className="col-md-6 mb-3">
                            <label className="form-label">Team Code (optional)</label>
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
                            <label className="form-label">Category (optional)</label>
                            <input
                                type="text"
                                name="category"
                                className="form-control"
                                value={formData.category}
                                onChange={handleChange}
                                placeholder="e.g. Senior"
                            />
                        </div>

                        <div className="col-md-4 mb-3">
                            <label className="form-label">Age Group (optional)</label>
                            <select
                                name="age_group"
                                className="form-select"
                                value={formData.age_group}
                                onChange={handleChange}
                            >
                                <option value="">Select Age Group</option>
                                {ageGroups.map((g) => (
                                    <option key={g.id} value={g.age_group}>{g.age_group}</option>
                                ))}
                            </select>
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
                        <button type="submit" className="btn btn-primary" disabled={loading}>
                            {loading ? "Saving..." : isEdit ? "Update Team" : "Add Team"}
                        </button>
                        <button type="button" className="btn btn-secondary" onClick={() => router.push(returnTo)}>
                            Cancel
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
