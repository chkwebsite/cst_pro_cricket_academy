"use client";

import { useState, useEffect, useCallback } from "react";
import {
    Calendar,
    Users,
    Search,
    CheckCircle2,
    AlertCircle,
    Building2,
    MapPin,
    Shield,
    Loader2,
    RefreshCw,
    Save,
    Check,
    RotateCcw
} from "lucide-react";
import { useUser } from "../components/UserContext";
import { getUserRole, ROLES } from "../../components/lib/rbac-rules";
import styles from "./user-weekly-off.module.css";

const DAYS_OF_WEEK = [
    { key: "Monday", label: "Mon", full: "Monday" },
    { key: "Tuesday", label: "Tue", full: "Tuesday" },
    { key: "Wednesday", label: "Wed", full: "Wednesday" },
    { key: "Thursday", label: "Thu", full: "Thursday" },
    { key: "Friday", label: "Fri", full: "Friday" },
    { key: "Saturday", label: "Sat", full: "Saturday" },
    { key: "Sunday", label: "Sun", full: "Sunday" },
];

export default function UserWeeklyOffPage() {
    const { user } = useUser();
    const role = getUserRole(user);

    const isSuperAdmin = role === ROLES.SUPER_ADMIN;
    const isAcademyAdmin = role === ROLES.ACADEMY_ADMIN;
    const isBranchAdmin = role === ROLES.BRANCH_ADMIN;

    // Tenant Selection State
    const [academies, setAcademies] = useState([]);
    const [branches, setBranches] = useState([]);
    const [selectedAcademy, setSelectedAcademy] = useState(user?.academy_id ? String(user.academy_id) : "");
    const [selectedBranch, setSelectedBranch] = useState(user?.branch_id ? String(user.branch_id) : "");

    // Filter states
    const [userTypeFilter, setUserTypeFilter] = useState("All"); // "All" | "Staff" | "Coach" | "Player"
    const [searchQuery, setSearchQuery] = useState("");

    // Data States
    const [users, setUsers] = useState([]);
    const [weeklyOffMap, setWeeklyOffMap] = useState({}); // { [user_id]: ['Sunday', ...] }
    const [loadingData, setLoadingData] = useState(false);
    const [savingStates, setSavingStates] = useState({}); // { [user_id]: 'saving' | 'saved' | 'error' }
    const [error, setError] = useState("");
    const [toastMessage, setToastMessage] = useState(null);

    // Toast helper
    const showToast = useCallback((message, type = "success") => {
        setToastMessage({ message, type });
        setTimeout(() => setToastMessage(null), 3000);
    }, []);

    // 1. Load Academies (Super Admin only)
    useEffect(() => {
        if (!isSuperAdmin) {
            if (user?.academy_id) {
                setSelectedAcademy(String(user.academy_id));
            }
            return;
        }

        async function fetchAcademies() {
            try {
                const res = await fetch("/api/academies");
                const json = await res.json();
                if (res.ok && json.success) {
                    const list = json.data || [];
                    setAcademies(list);
                    if (list.length > 0 && !selectedAcademy) {
                        setSelectedAcademy(String(list[0].id));
                    }
                }
            } catch (err) {
                console.error("Failed to load academies:", err);
            }
        }
        fetchAcademies();
    }, [isSuperAdmin, user?.academy_id]);

    // 2. Load Branches based on Selected Academy & Role
    useEffect(() => {
        if (isBranchAdmin) {
            if (user?.branch_id) {
                setSelectedBranch(String(user.branch_id));
            }
            if (user?.academy_id) {
                setSelectedAcademy(String(user.academy_id));
            }
            return;
        }

        const effectiveAcademy = isSuperAdmin ? selectedAcademy : user?.academy_id;
        if (!effectiveAcademy) {
            setBranches([]);
            return;
        }

        async function fetchBranches() {
            try {
                const res = await fetch(`/api/branch?academy_id=${effectiveAcademy}`);
                const json = await res.json();
                if (res.ok && json.success) {
                    const list = json.data || [];
                    setBranches(list);
                    if (list.length > 0) {
                        const exists = list.some((b) => String(b.id) === String(selectedBranch));
                        if (!exists || !selectedBranch) {
                            setSelectedBranch(String(list[0].id));
                        }
                    } else {
                        setSelectedBranch("");
                    }
                }
            } catch (err) {
                console.error("Failed to load branches:", err);
            }
        }
        fetchBranches();
    }, [isSuperAdmin, isBranchAdmin, selectedAcademy, user?.academy_id, user?.branch_id]);

    // 3. Load Users and Weekly Off Records
    const loadData = useCallback(async () => {
        const effectiveAcademy = isSuperAdmin ? selectedAcademy : user?.academy_id;
        const effectiveBranch = isBranchAdmin ? user?.branch_id : selectedBranch;

        if (!effectiveAcademy || !effectiveBranch) {
            setUsers([]);
            setWeeklyOffMap({});
            return;
        }

        setLoadingData(true);
        setError("");

        try {
            // Fetch users of branch
            const usersRes = await fetch(
                `/api/users?academy_id=${effectiveAcademy}&branch_id=${effectiveBranch}&is_deleted=0&status=1`
            );
            const usersJson = await usersRes.json();
            if (!usersRes.ok || !usersJson.success) {
                throw new Error(usersJson.message || "Failed to load branch users");
            }
            setUsers(usersJson.data || []);

            // Fetch weekly offs
            const offRes = await fetch(
                `/api/user-weekly-off?academy_id=${effectiveAcademy}&branch_id=${effectiveBranch}`
            );
            const offJson = await offRes.json();
            if (!offRes.ok || !offJson.success) {
                throw new Error(offJson.message || "Failed to load weekly off records");
            }
            setWeeklyOffMap(offJson.userDaysMap || {});
        } catch (err) {
            console.error("Load weekly off error:", err);
            setError(err.message || "Failed to load user weekly off data.");
        } finally {
            setLoadingData(false);
        }
    }, [isBranchAdmin, isSuperAdmin, selectedAcademy, selectedBranch, user?.academy_id, user?.branch_id]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    // Save user's weekly off days
    const saveUserDays = async (targetUser, newDays) => {
        const userId = targetUser.id;
        const oldDays = weeklyOffMap[userId] || [];

        // Optimistic UI update
        setWeeklyOffMap((prev) => ({
            ...prev,
            [userId]: newDays,
        }));
        setSavingStates((prev) => ({ ...prev, [userId]: "saving" }));

        const effectiveAcademy = isSuperAdmin ? selectedAcademy : user?.academy_id;
        const effectiveBranch = isBranchAdmin ? user?.branch_id : selectedBranch;

        try {
            const res = await fetch("/api/user-weekly-off", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    academy_id: Number(effectiveAcademy),
                    branch_id: Number(effectiveBranch),
                    user_id: userId,
                    days: newDays,
                }),
            });

            const json = await res.json();
            if (!res.ok || !json.success) {
                throw new Error(json.message || "Save failed");
            }

            setSavingStates((prev) => ({ ...prev, [userId]: "saved" }));
            setTimeout(() => {
                setSavingStates((prev) => {
                    const copy = { ...prev };
                    delete copy[userId];
                    return copy;
                });
            }, 1200);
        } catch (err) {
            console.error("Save weekly off error:", err);
            // Revert on error
            setWeeklyOffMap((prev) => ({
                ...prev,
                [userId]: oldDays,
            }));
            setSavingStates((prev) => ({ ...prev, [userId]: "error" }));
            showToast(`Failed to update ${targetUser.first_name}'s off days: ${err.message}`, "error");
        }
    };

    // Toggle single day for user
    const handleToggleDay = (targetUser, dayKey) => {
        const currentDays = weeklyOffMap[targetUser.id] || [];
        let updatedDays;
        if (currentDays.includes(dayKey)) {
            updatedDays = currentDays.filter((d) => d !== dayKey);
        } else {
            updatedDays = [...currentDays, dayKey];
        }
        saveUserDays(targetUser, updatedDays);
    };

    // Filtered users list
    const filteredUsers = users.filter((u) => {
        const rawType = String(u.user_type || "").toLowerCase();
        if (userTypeFilter === "Staff" && (rawType.includes("player") || rawType.includes("coach"))) return false;
        if (userTypeFilter === "Coach" && !rawType.includes("coach")) return false;
        if (userTypeFilter === "Player" && !rawType.includes("player")) return false;

        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            const fullName = `${u.first_name || ""} ${u.last_name || ""}`.toLowerCase();
            const email = String(u.email || "").toLowerCase();
            const appNo = String(u.appointment_no || "").toLowerCase();
            return fullName.includes(q) || email.includes(q) || appNo.includes(q);
        }
        return true;
    });

    // Bulk apply preset to all filtered users
    const handleBulkApply = async (presetDays, label) => {
        const effectiveAcademy = isSuperAdmin ? selectedAcademy : user?.academy_id;
        const effectiveBranch = isBranchAdmin ? user?.branch_id : selectedBranch;

        if (filteredUsers.length === 0) {
            showToast("No visible users to apply.", "error");
            return;
        }

        try {
            setLoadingData(true);
            const promises = filteredUsers.map((u) =>
                fetch("/api/user-weekly-off", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        academy_id: Number(effectiveAcademy),
                        branch_id: Number(effectiveBranch),
                        user_id: u.id,
                        days: presetDays,
                    }),
                })
            );
            await Promise.all(promises);

            const newMap = { ...weeklyOffMap };
            filteredUsers.forEach((u) => {
                newMap[u.id] = presetDays;
            });
            setWeeklyOffMap(newMap);
            showToast(`Applied "${label}" to ${filteredUsers.length} users successfully!`, "success");
        } catch (err) {
            console.error("Bulk apply error:", err);
            showToast(`Bulk update failed: ${err.message}`, "error");
        } finally {
            setLoadingData(false);
        }
    };

    return (
        <div className={styles.container}>
            {/* Toast Notification */}
            {toastMessage && (
                <div
                    className={`alert alert-${toastMessage.type === "error" ? "danger" : "success"} position-fixed top-0 end-0 m-3 shadow-lg`}
                    style={{ zIndex: 9999, minWidth: "280px" }}
                >
                    <div className="d-flex align-items-center gap-2">
                        {toastMessage.type === "error" ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
                        <span>{toastMessage.message}</span>
                    </div>
                </div>
            )}

            {/* Header Card */}
            <div className={styles.headerCard}>
                <div className="d-flex flex-wrap justify-content-between align-items-center gap-3">
                    <div>
                        <div className="d-flex align-items-center gap-2">
                            <h4 className="mb-0 fw-bold text-dark d-flex align-items-center gap-2">
                                <Calendar className="text-primary" size={26} />
                                User Weekly Off Management
                            </h4>
                            <span className="badge bg-primary-subtle text-primary border border-primary-subtle px-2 py-1">
                                {isSuperAdmin ? "Super Admin Access" : isAcademyAdmin ? "Academy Admin Access" : "Branch Admin Access"}
                            </span>
                        </div>
                        <p className="text-muted small mb-0 mt-1">
                            Configure weekly rest days (Monday to Sunday) for users. Selected weekly off days automatically reflect in the attendance sheet as &quot;Week off&quot;.
                        </p>
                    </div>

                    <div className="d-flex align-items-center gap-2">
                        <button
                            type="button"
                            className="btn btn-sm btn-outline-secondary d-inline-flex align-items-center gap-1"
                            onClick={loadData}
                            disabled={loadingData}
                        >
                            <RefreshCw size={14} className={loadingData ? "spin" : ""} />
                            Refresh
                        </button>
                    </div>
                </div>
            </div>

            {/* Filter Card */}
            <div className={styles.filterCard}>
                <div className="row g-3 align-items-center">
                    {/* Super Admin: Academy Selector */}
                    {isSuperAdmin && (
                        <div className="col-md-3 col-sm-6">
                            <label className="form-label text-muted small fw-bold mb-1 d-flex align-items-center gap-1">
                                <Building2 size={14} />
                                Academy
                            </label>
                            <select
                                className="form-select form-select-sm"
                                value={selectedAcademy}
                                onChange={(e) => {
                                    setSelectedAcademy(e.target.value);
                                    setSelectedBranch("");
                                }}
                            >
                                <option value="">-- Select Academy --</option>
                                {academies.map((a) => (
                                    <option key={a.id} value={a.id}>
                                        {a.name || a.academy_name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}

                    {/* Academy or Super Admin: Branch Selector */}
                    {(isSuperAdmin || isAcademyAdmin) && (
                        <div className="col-md-3 col-sm-6">
                            <label className="form-label text-muted small fw-bold mb-1 d-flex align-items-center gap-1">
                                <MapPin size={14} />
                                Branch
                            </label>
                            <select
                                className="form-select form-select-sm"
                                value={selectedBranch}
                                onChange={(e) => setSelectedBranch(e.target.value)}
                                disabled={isSuperAdmin && !selectedAcademy}
                            >
                                <option value="">-- Select Branch --</option>
                                {branches.map((b) => (
                                    <option key={b.id} value={b.id}>
                                        {b.branch_name || b.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}

                    {/* Branch Admin: Branch Badge Display */}
                    {isBranchAdmin && (
                        <div className="col-md-3 col-sm-6">
                            <label className="form-label text-muted small fw-bold mb-1 d-flex align-items-center gap-1">
                                <MapPin size={14} />
                                My Branch
                            </label>
                            <div className="badge bg-light text-dark border p-2 w-100 text-start text-truncate">
                                Branch #{user?.branch_id}
                            </div>
                        </div>
                    )}

                    {/* Role / User Type Filter */}
                    <div className="col-md-3 col-sm-6">
                        <label className="form-label text-muted small fw-bold mb-1 d-flex align-items-center gap-1">
                            <Shield size={14} />
                            Role Filter
                        </label>
                        <select
                            className="form-select form-select-sm"
                            value={userTypeFilter}
                            onChange={(e) => setUserTypeFilter(e.target.value)}
                        >
                            <option value="All">All Roles ({users.length})</option>
                            <option value="Staff">Staff Only</option>
                            <option value="Coach">Coaches Only</option>
                            <option value="Player">Players Only</option>
                        </select>
                    </div>

                    {/* Search */}
                    <div className="col-md-3 col-sm-6">
                        <label className="form-label text-muted small fw-bold mb-1 d-flex align-items-center gap-1">
                            <Search size={14} />
                            Search User
                        </label>
                        <div className="input-group input-group-sm">
                            <input
                                type="text"
                                className="form-control"
                                placeholder="Search by name, email..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                            {searchQuery && (
                                <button
                                    type="button"
                                    className="btn btn-outline-secondary"
                                    onClick={() => setSearchQuery("")}
                                >
                                    &times;
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* Bulk Action Sub-bar */}
                <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mt-3 pt-2 border-top">
                    <div className="d-flex align-items-center gap-2">
                        <span className="text-muted small fw-semibold">Quick Bulk Set:</span>
                        <button
                            type="button"
                            className="btn btn-sm btn-outline-primary"
                            onClick={() => handleBulkApply(["Sunday"], "Sunday Only")}
                            disabled={loadingData || filteredUsers.length === 0}
                        >
                            Set Sunday Off for All
                        </button>
                        <button
                            type="button"
                            className="btn btn-sm btn-outline-purple"
                            style={{ borderColor: "#a855f7", color: "#7e22ce" }}
                            onClick={() => handleBulkApply(["Saturday", "Sunday"], "Sat & Sun")}
                            disabled={loadingData || filteredUsers.length === 0}
                        >
                            Set Sat &amp; Sun Off for All
                        </button>
                        <button
                            type="button"
                            className="btn btn-sm btn-outline-danger"
                            onClick={() => handleBulkApply([], "Clear All")}
                            disabled={loadingData || filteredUsers.length === 0}
                        >
                            Clear All Offs
                        </button>
                    </div>

                    <div className="text-muted small">
                        Showing <strong>{filteredUsers.length}</strong> of {users.length} users
                    </div>
                </div>
            </div>

            {/* Error Message */}
            {error && (
                <div className="alert alert-danger d-flex align-items-center gap-2 mb-3">
                    <AlertCircle size={18} />
                    <span>{error}</span>
                </div>
            )}

            {/* Weekly Off Table */}
            <div className={styles.tableWrapper}>
                {loadingData ? (
                    <div className="text-center py-5">
                        <Loader2 size={32} className="spin text-primary mb-2" />
                        <div className="text-muted fw-semibold">Loading user schedules...</div>
                    </div>
                ) : filteredUsers.length === 0 ? (
                    <div className="text-center py-5">
                        <Users size={36} className="text-muted opacity-50 mb-2" />
                        <h6 className="fw-bold text-dark">No users found</h6>
                        <p className="text-muted small mb-0">
                            No users match the selected branch and criteria.
                        </p>
                    </div>
                ) : (
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                <th style={{ minWidth: "240px" }}>User Details</th>
                                <th style={{ minWidth: "120px" }}>User Role</th>
                                <th style={{ minWidth: "340px", textAlign: "center" }}>
                                    Weekly Off Schedule (Click to Toggle)
                                </th>
                                <th style={{ minWidth: "200px", textAlign: "center" }}>Quick Presets</th>
                                <th style={{ minWidth: "100px", textAlign: "center" }}>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredUsers.map((targetUser) => {
                                const userDays = weeklyOffMap[targetUser.id] || [];
                                const savingState = savingStates[targetUser.id];
                                const isPlayer = String(targetUser.user_type || "").toLowerCase().includes("player");

                                return (
                                    <tr key={targetUser.id}>
                                        {/* User Info */}
                                        <td>
                                            <div className="d-flex align-items-center gap-2">
                                                <div
                                                    className="rounded-circle d-flex align-items-center justify-content-center text-white fw-bold"
                                                    style={{
                                                        width: "36px",
                                                        height: "36px",
                                                        minWidth: "36px",
                                                        backgroundColor: isPlayer ? "#0d9488" : "#4f46e5",
                                                        fontSize: "0.85rem",
                                                    }}
                                                >
                                                    {(targetUser.first_name || "U")[0]?.toUpperCase()}
                                                </div>
                                                <div className="text-truncate">
                                                    <div className="fw-bold text-dark text-truncate">
                                                        {targetUser.first_name} {targetUser.last_name || ""}
                                                    </div>
                                                    <div className="text-muted small text-truncate" style={{ fontSize: "0.75rem" }}>
                                                        {targetUser.email || (targetUser.appointment_no ? `#${targetUser.appointment_no}` : `User #${targetUser.id}`)}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>

                                        {/* Role Badge */}
                                        <td>
                                            <span
                                                className="badge"
                                                style={{
                                                    fontSize: "0.72rem",
                                                    backgroundColor: isPlayer ? "#ccfbf1" : "#e0e7ff",
                                                    color: isPlayer ? "#0f766e" : "#4338ca",
                                                }}
                                            >
                                                {targetUser.user_type || "User"}
                                            </span>
                                        </td>

                                        {/* 7-Day Badges */}
                                        <td>
                                            <div className="d-flex justify-content-center align-items-center gap-2">
                                                {DAYS_OF_WEEK.map((day) => {
                                                    const isOff = userDays.includes(day.key);
                                                    return (
                                                        <button
                                                            key={day.key}
                                                            type="button"
                                                            className={`${styles.dayPill} ${isOff ? styles.dayOff : styles.dayWork}`}
                                                            onClick={() => handleToggleDay(targetUser, day.key)}
                                                            title={`${day.full}: ${isOff ? "WEEK OFF (Click to set as Working Day)" : "WORKING DAY (Click to set as Week Off)"}`}
                                                        >
                                                            {day.label}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </td>

                                        {/* Quick Row Presets */}
                                        <td>
                                            <div className="d-flex justify-content-center align-items-center gap-1">
                                                <button
                                                    type="button"
                                                    className={styles.presetBtn}
                                                    onClick={() => saveUserDays(targetUser, ["Sunday"])}
                                                    title="Set Sunday as only weekly off"
                                                >
                                                    Sunday
                                                </button>
                                                <button
                                                    type="button"
                                                    className={styles.presetBtn}
                                                    onClick={() => saveUserDays(targetUser, ["Saturday", "Sunday"])}
                                                    title="Set Saturday & Sunday off"
                                                >
                                                    Sat-Sun
                                                </button>
                                                <button
                                                    type="button"
                                                    className={styles.presetBtn}
                                                    onClick={() => saveUserDays(targetUser, [])}
                                                    title="Clear all weekly offs"
                                                >
                                                    None
                                                </button>
                                            </div>
                                        </td>

                                        {/* Status / Save Indicator */}
                                        <td style={{ textAlign: "center" }}>
                                            {savingState === "saving" && (
                                                <span className={styles.savingIndicator}>
                                                    <Loader2 size={13} className="spin" />
                                                    Saving
                                                </span>
                                            )}
                                            {savingState === "saved" && (
                                                <span className="text-success small fw-semibold d-inline-flex align-items-center gap-1">
                                                    <Check size={14} />
                                                    Saved
                                                </span>
                                            )}
                                            {!savingState && (
                                                <span className="text-muted small">
                                                    {userDays.length} {userDays.length === 1 ? "day off" : "days off"}
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}
