"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import {
    Calendar,
    CalendarCheck,
    CheckCircle2,
    XCircle,
    Clock,
    AlertCircle,
    UserX,
    Users,
    Search,
    ChevronLeft,
    ChevronRight,
    Building2,
    MapPin,
    Shield,
    Check,
    Loader2,
    RefreshCw,
    Filter,
    UserCheck,
    Briefcase
} from "lucide-react";
import { useUser } from "../components/UserContext";
import { getUserRole, ROLES } from "../../components/lib/rbac-rules";
import styles from "./attendance.module.css";

const MONTH_NAMES = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
];

const WEEKDAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const FULL_WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const ATTENDANCE_OPTIONS = [
    { value: "", label: "--", classKey: "Empty" },
    { value: "Present", label: "Present", code: "P", classKey: "Present" },
    { value: "Absent", label: "Absent", code: "A", classKey: "Absent" },
    { value: "Late", label: "Late", code: "L", classKey: "Late" },
    { value: "Half Day", label: "Half Day", code: "HD", classKey: "HalfDay" },
    { value: "Leave", label: "Leave", code: "LV", classKey: "Leave" },
];

export default function AttendanceMatrixPage() {
    const { user } = useUser();
    const role = getUserRole(user);

    const isSuperAdmin = role === ROLES.SUPER_ADMIN;
    const isAcademyAdmin = role === ROLES.ACADEMY_ADMIN;
    const isBranchAdmin = role === ROLES.BRANCH_ADMIN;
    const isMasterAdmin = isSuperAdmin || isAcademyAdmin || isBranchAdmin;

    // Current Date Reference
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth() + 1; // 1-12
    const currentDay = today.getDate();
    const todayDateStr = `${currentYear}-${String(currentMonth).padStart(2, "0")}-${String(currentDay).padStart(2, "0")}`;

    // Month & Year state
    const [selectedYear, setSelectedYear] = useState(currentYear);
    const [selectedMonth, setSelectedMonth] = useState(currentMonth);

    // Tenant Selection State
    const [academies, setAcademies] = useState([]);
    const [branches, setBranches] = useState([]);
    const [selectedAcademy, setSelectedAcademy] = useState(user?.academy_id ? String(user.academy_id) : "");
    const [selectedBranch, setSelectedBranch] = useState(user?.branch_id ? String(user.branch_id) : "");

    // Filter states
    const [userTypeFilter, setUserTypeFilter] = useState("All"); // "All" | "Player" | "Staff"
    const [searchQuery, setSearchQuery] = useState("");

    // Data States
    const [users, setUsers] = useState([]);
    const [attendanceMap, setAttendanceMap] = useState({}); // Key: `${user_id}_${dateStr}` => status
    const [weeklyOffMap, setWeeklyOffMap] = useState({}); // Key: `${user_id}` => ['Sunday', ...]
    const [loadingData, setLoadingData] = useState(false);
    const [error, setError] = useState("");
    const [toastMessage, setToastMessage] = useState(null);

    // Cell saving tracker: { [`${user_id}_${dateStr}`]: true | "saved" | "error" }
    const [savingStates, setSavingStates] = useState({});

    // Year selection range (last year to next 2 years)
    const yearOptions = useMemo(() => {
        return [currentYear - 1, currentYear, currentYear + 1, currentYear + 2];
    }, [currentYear]);

    // Calculate days in selected month (28, 29, 30, or 31)
    const daysInMonth = useMemo(() => {
        return new Date(selectedYear, selectedMonth, 0).getDate();
    }, [selectedYear, selectedMonth]);

    const daysArray = useMemo(() => {
        return Array.from({ length: daysInMonth }, (_, i) => i + 1);
    }, [daysInMonth]);

    // Show toast helper
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
                    // Select first branch by default if not set or if current selection not in list
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

    // 3. Load Users and Attendance Records for Selected Branch, Month & Year
    const loadMatrixData = useCallback(async () => {
        // Self-Attendance Mode (Regular roles: Coach, Player, Staff, Accountant, Management, Ground Staff)
        if (!isMasterAdmin) {
            if (!user?.id) return;
            setLoadingData(true);
            setError("");

            try {
                // Strictly single self row
                const selfUser = [{
                    id: user.id,
                    first_name: user.first_name || user.name || "My",
                    last_name: user.last_name || "",
                    user_type: user.user_type || user.role_name || "User",
                    email: user.email || "",
                    appointment_no: user.appointment_no || "",
                    date_of_joining: user.date_of_joining || null,
                }];
                setUsers(selfUser);

                // Fetch own attendance records for selected month
                const attRes = await fetch(
                    `/api/attendance?user_id=${user.id}&month=${selectedMonth}&year=${selectedYear}`
                );
                const attJson = await attRes.json();

                if (!attRes.ok || !attJson.success) {
                    throw new Error(attJson.message || "Failed to load your attendance records");
                }

                const map = {};
                (attJson.data || []).forEach((record) => {
                    const dateKey = String(record.attendance_date).slice(0, 10);
                    const key = `${record.user_id}_${dateKey}`;
                    map[key] = record.attendance_status;
                });
                setAttendanceMap(map);

                // Fetch own weekly off schedule
                try {
                    const wOffRes = await fetch(`/api/user-weekly-off?user_id=${user.id}`);
                    const wOffJson = await wOffRes.json();
                    if (wOffRes.ok && wOffJson.success) {
                        setWeeklyOffMap(wOffJson.userDaysMap || {});
                    }
                } catch (wErr) {
                    console.error("Weekly off fetch error:", wErr);
                }
            } catch (err) {
                console.error("Self attendance load error:", err);
                setError(err.message || "Failed to load personal attendance data.");
            } finally {
                setLoadingData(false);
            }
            return;
        }

        // Master Admin Mode (Super Admin, Academy Admin, Branch Admin)
        const effectiveBranch = isBranchAdmin ? user?.branch_id : selectedBranch;
        const effectiveAcademy = isSuperAdmin ? selectedAcademy : user?.academy_id;

        if (!effectiveBranch || !effectiveAcademy) {
            setUsers([]);
            setAttendanceMap({});
            setWeeklyOffMap({});
            return;
        }

        setLoadingData(true);
        setError("");

        try {
            // Fetch Users of this branch
            const usersRes = await fetch(
                `/api/users?academy_id=${effectiveAcademy}&branch_id=${effectiveBranch}&is_deleted=0&status=1`
            );
            const usersJson = await usersRes.json();

            if (!usersRes.ok || !usersJson.success) {
                throw new Error(usersJson.message || "Failed to load branch users");
            }
            const fetchedUsers = usersJson.data || [];
            setUsers(fetchedUsers);

            // Fetch User Weekly Off records
            try {
                const wOffRes = await fetch(
                    `/api/user-weekly-off?academy_id=${effectiveAcademy}&branch_id=${effectiveBranch}`
                );
                const wOffJson = await wOffRes.json();
                if (wOffRes.ok && wOffJson.success) {
                    setWeeklyOffMap(wOffJson.userDaysMap || {});
                }
            } catch (wErr) {
                console.error("Weekly off fetch error:", wErr);
            }

            // Fetch Attendance Records for this month & year
            const attRes = await fetch(
                `/api/attendance?academy_id=${effectiveAcademy}&branch_id=${effectiveBranch}&month=${selectedMonth}&year=${selectedYear}`
            );
            const attJson = await attRes.json();

            if (!attRes.ok || !attJson.success) {
                throw new Error(attJson.message || "Failed to load attendance records");
            }

            // Index attendance by `${user_id}_${YYYY-MM-DD}`
            const map = {};
            (attJson.data || []).forEach((record) => {
                const dateKey = String(record.attendance_date).slice(0, 10);
                const key = `${record.user_id}_${dateKey}`;
                map[key] = record.attendance_status;
            });

            setAttendanceMap(map);
        } catch (err) {
            console.error("Matrix load error:", err);
            setError(err.message || "Failed to load attendance matrix data.");
        } finally {
            setLoadingData(false);
        }
    }, [isMasterAdmin, isBranchAdmin, isSuperAdmin, selectedAcademy, selectedBranch, selectedMonth, selectedYear, user]);

    useEffect(() => {
        loadMatrixData();
    }, [loadMatrixData]);

    // Auto-save Attendance Status on Dropdown Select
    const handleStatusChange = async (targetUser, day, newStatus) => {
        const dateStr = `${selectedYear}-${String(selectedMonth).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        const key = `${targetUser.id}_${dateStr}`;
        const oldStatus = attendanceMap[key] || "";

        if (oldStatus === newStatus) return;

        // Optimistic UI Update
        setAttendanceMap((prev) => ({
            ...prev,
            [key]: newStatus,
        }));

        setSavingStates((prev) => ({ ...prev, [key]: "saving" }));

        const effectiveAcademy = isSuperAdmin ? selectedAcademy : (user?.academy_id || 1);
        const effectiveBranch = isBranchAdmin ? user?.branch_id : (selectedBranch || user?.branch_id || 1);
        const attType = String(targetUser.user_type || "").toLowerCase().includes("player") ? "Player" : "Staff";

        try {
            const res = await fetch("/api/attendance", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    academy_id: Number(effectiveAcademy),
                    branch_id: Number(effectiveBranch),
                    user_id: targetUser.id,
                    attendance_type: attType,
                    attendance_date: dateStr,
                    attendance_status: newStatus,
                }),
            });

            const json = await res.json();

            if (!res.ok || !json.success) {
                throw new Error(json.message || "Save failed");
            }

            setSavingStates((prev) => ({ ...prev, [key]: "saved" }));
            setTimeout(() => {
                setSavingStates((prev) => {
                    const copy = { ...prev };
                    delete copy[key];
                    return copy;
                });
            }, 1200);
        } catch (err) {
            console.error("Auto-save error:", err);
            // Revert optimistic update
            setAttendanceMap((prev) => ({
                ...prev,
                [key]: oldStatus,
            }));
            setSavingStates((prev) => ({ ...prev, [key]: "error" }));
            showToast(`Failed to update ${targetUser.first_name}'s status: ${err.message}`, "error");
        }
    };

    // Filter Users by Type and Search Term
    const filteredUsers = users.filter((u) => {
        const isPlayer = String(u.user_type || "").toLowerCase().includes("player");
        if (userTypeFilter === "Player" && !isPlayer) return false;
        if (userTypeFilter === "Staff" && isPlayer) return false;

        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            const fullName = `${u.first_name || ""} ${u.last_name || ""}`.toLowerCase();
            const appNo = String(u.appointment_no || "").toLowerCase();
            const email = String(u.email || "").toLowerCase();
            return fullName.includes(q) || appNo.includes(q) || email.includes(q);
        }
        return true;
    });

    // Quick Action: Mark All Present For Today
    const handleMarkAllTodayPresent = async () => {
        if (selectedYear !== currentYear || selectedMonth !== currentMonth) {
            showToast("Can only bulk-mark for the current month and day.", "error");
            return;
        }

        const effectiveAcademy = isSuperAdmin ? selectedAcademy : user?.academy_id;
        const effectiveBranch = isBranchAdmin ? user?.branch_id : selectedBranch;

        if (filteredUsers.length === 0) {
            showToast("No visible users to mark.", "error");
            return;
        }

        const items = filteredUsers.map((u) => ({
            academy_id: Number(effectiveAcademy),
            branch_id: Number(effectiveBranch),
            user_id: u.id,
            attendance_type: String(u.user_type || "").toLowerCase().includes("player") ? "Player" : "Staff",
            attendance_date: todayDateStr,
            attendance_status: "Present",
        }));

        // Optimistic update
        const updatedMap = { ...attendanceMap };
        filteredUsers.forEach((u) => {
            updatedMap[`${u.id}_${todayDateStr}`] = "Present";
        });
        setAttendanceMap(updatedMap);

        try {
            const res = await fetch("/api/attendance", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ items }),
            });
            const json = await res.json();
            if (!res.ok || !json.success) {
                throw new Error(json.message || "Bulk update failed");
            }
            showToast(`Marked ${filteredUsers.length} users Present for today!`, "success");
        } catch (err) {
            console.error("Bulk mark error:", err);
            showToast(`Bulk mark failed: ${err.message}`, "error");
            loadMatrixData(); // Reload to restore actual state
        }
    };

    // Month Navigation Helpers
    const handlePrevMonth = () => {
        if (selectedMonth === 1) {
            setSelectedMonth(12);
            setSelectedYear((y) => y - 1);
        } else {
            setSelectedMonth((m) => m - 1);
        }
    };

    const handleNextMonth = () => {
        if (selectedMonth === 12) {
            setSelectedMonth(1);
            setSelectedYear((y) => y + 1);
        } else {
            setSelectedMonth((m) => m + 1);
        }
    };

    // Monthly Row Statistics Calculator
    // Monthly Row Statistics Calculator
    // Considers Date of Joining (DOJ): Attendance and working days are strictly calculated from DOJ
    const calculateUserStats = (userId) => {
        let p = 0, a = 0, l = 0, hd = 0, lv = 0;
        let weekOffPastCount = 0;
        let totalWorkingDaysElapsed = 0;
        let totalMonthWorkingDays = 0;
        const userDays = weeklyOffMap[userId] || [];

        const isCurrentMonth = (selectedYear === currentYear && selectedMonth === currentMonth);
        const isPastMonth = (selectedYear < currentYear || (selectedYear === currentYear && selectedMonth < currentMonth));

        const targetUser = users.find((u) => u.id === userId) || (user?.id === userId ? user : null);
        const dojStr = targetUser?.date_of_joining ? String(targetUser.date_of_joining).slice(0, 10) : null;
        let dojYear = null, dojMonth = null, dojDay = 1;
        let isNotEmployedYet = false;
        let isJoiningMonth = false;

        if (dojStr) {
            const parts = dojStr.split("-").map(Number);
            if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
                dojYear = parts[0];
                dojMonth = parts[1];
                dojDay = parts[2];

                if (selectedYear < dojYear || (selectedYear === dojYear && selectedMonth < dojMonth)) {
                    isNotEmployedYet = true;
                } else if (selectedYear === dojYear && selectedMonth === dojMonth) {
                    isJoiningMonth = true;
                }
            }
        }

        if (isNotEmployedYet) {
            return {
                p: 0, a: 0, l: 0, hd: 0, lv: 0,
                weekOffPastCount: 0,
                totalWorkingDaysElapsed: 0,
                totalMonthWorkingDays: 0,
                percentage: 0,
                isNotEmployedYet: true,
                isJoiningMonth: false,
                joiningDay: dojDay,
                dojStr,
            };
        }

        const effectiveStartDay = isJoiningMonth ? Math.min(Math.max(1, dojDay), daysInMonth) : 1;

        let totalElapsedDays = 0;
        let totalMonthDays = 0;

        for (let d = 1; d <= daysInMonth; d++) {
            // Prior to joining date in the joining month: do NOT count in working days, week offs, or absences!
            if (isJoiningMonth && d < effectiveStartDay) {
                continue;
            }

            const dateObj = new Date(selectedYear, selectedMonth - 1, d);
            const weekday = FULL_WEEKDAY_NAMES[dateObj.getDay()];
            const isWeeklyOff = userDays.includes(weekday);
            const isPastOrToday = isPastMonth || (isCurrentMonth && d <= currentDay);

            // "week off ko bhi working day me add hoga": Week offs are counted as working days!
            totalMonthDays++;

            if (isPastOrToday) {
                totalElapsedDays++;
                if (isWeeklyOff) {
                    weekOffPastCount++;
                }
            }

            const dateStr = `${selectedYear}-${String(selectedMonth).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
            const status = attendanceMap[`${userId}_${dateStr}`];
            if (status === "Present") p++;
            else if (status === "Absent") a++;
            else if (status === "Late") l++;
            else if (status === "Half Day") hd++;
            else if (status === "Leave") lv++;
        }

        // Attendance Deduction Rules:
        // Absent = 1.0 day deducted
        // Leave = 1.0 day deducted
        // Half Day = 0.5 day deducted
        // Late = 0.25 day deducted
        // Week off = 0.0 deducted (Paid working day)
        const totalDeductedDays = Math.round(((a * 1.0) + (lv * 1.0) + (hd * 0.5) + (l * 0.25)) * 100) / 100;
        const effectiveWorkingDays = Math.max(0, Math.round((totalElapsedDays - totalDeductedDays) * 100) / 100);
        const monthPayableDays = Math.max(0, Math.round((totalMonthDays - totalDeductedDays) * 100) / 100);
        const percentage = totalElapsedDays > 0 ? Math.round((effectiveWorkingDays / totalElapsedDays) * 100) : 0;

        return {
            p,
            a,
            l,
            hd,
            lv,
            totalDeductedDays,
            weekOffPastCount,
            totalWorkingDaysElapsed: effectiveWorkingDays,
            totalMonthWorkingDays: monthPayableDays,
            totalBaseDays: totalMonthDays,
            totalElapsedDays,
            percentage,
            isNotEmployedYet: false,
            isJoiningMonth,
            joiningDay: effectiveStartDay,
            dojStr,
        };
    };

    return (
        <div className={styles.container}>
            {/* Toast Alert */}
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
                                <CalendarCheck className="text-primary" size={26} />
                                {isMasterAdmin ? "Monthly Attendance Sheet" : "My Attendance Sheet"}
                            </h4>
                            <span className="badge bg-primary-subtle text-primary border border-primary-subtle px-2 py-1">
                                {isSuperAdmin ? "Super Admin Access" : isAcademyAdmin ? "Academy Admin Access" : isBranchAdmin ? "Branch Admin Access" : `Self Attendance (${user?.user_type || "User"})`}
                            </span>
                        </div>
                        <p className="text-muted small mb-0 mt-1">
                            {isMasterAdmin
                                ? "Live branch attendance matrix with instant auto-save. Track present, absent, late, half-day, and leaves."
                                : "View your personal monthly working days, past weekly offs, and mark your daily attendance."}
                        </p>
                    </div>

                    {/* Month Quick Nav */}
                    <div className="d-flex align-items-center gap-2 bg-light p-1 rounded-pill border">
                        <button
                            type="button"
                            className="btn btn-sm btn-white rounded-circle shadow-none p-1"
                            onClick={handlePrevMonth}
                            title="Previous Month"
                        >
                            <ChevronLeft size={18} />
                        </button>
                        <span className="fw-semibold px-2 text-dark" style={{ minWidth: "140px", textAlign: "center" }}>
                            {MONTH_NAMES[selectedMonth - 1]} {selectedYear}
                        </span>
                        <button
                            type="button"
                            className="btn btn-sm btn-white rounded-circle shadow-none p-1"
                            onClick={handleNextMonth}
                            title="Next Month"
                        >
                            <ChevronRight size={18} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Filter Card */}
            <div className={styles.filterCard}>
                {isMasterAdmin ? (
                    <>
                        <div className="row g-3 align-items-center">
                            {/* 1. Super Admin Academy Selector */}
                            {isSuperAdmin && (
                                <div className="col-md-3 col-sm-6">
                                    <label className="form-label small fw-semibold text-muted d-flex align-items-center gap-1 mb-1">
                                        <Building2 size={14} className="text-primary" />
                                        Academy
                                    </label>
                                    <select
                                        className="form-select form-select-sm"
                                        value={selectedAcademy}
                                        onChange={(e) => setSelectedAcademy(e.target.value)}
                                    >
                                        {academies.map((ac) => (
                                            <option key={ac.id} value={ac.id}>
                                                {ac.academy_name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            {/* 2. Academy Admin & Super Admin Branch Selector */}
                            {(isSuperAdmin || isAcademyAdmin) && (
                                <div className="col-md-3 col-sm-6">
                                    <label className="form-label small fw-semibold text-muted d-flex align-items-center gap-1 mb-1">
                                        <MapPin size={14} className="text-primary" />
                                        Branch
                                    </label>
                                    <select
                                        className="form-select form-select-sm"
                                        value={selectedBranch}
                                        onChange={(e) => setSelectedBranch(e.target.value)}
                                        disabled={branches.length === 0}
                                    >
                                        {branches.length === 0 ? (
                                            <option value="">No branches found</option>
                                        ) : (
                                            branches.map((b) => (
                                                <option key={b.id} value={b.id}>
                                                    {b.branch_name} ({b.branch_code || "Branch"})
                                                </option>
                                            ))
                                        )}
                                    </select>
                                </div>
                            )}

                            {/* 3. Branch Admin Locked Badge */}
                            {isBranchAdmin && (
                                <div className="col-md-3 col-sm-6">
                                    <label className="form-label small fw-semibold text-muted d-flex align-items-center gap-1 mb-1">
                                        <Shield size={14} className="text-success" />
                                        Assigned Branch
                                    </label>
                                    <div className="form-control form-control-sm bg-light text-dark fw-semibold d-flex align-items-center gap-1">
                                        <MapPin size={14} className="text-success" />
                                        Branch #{user?.branch_id}
                                    </div>
                                </div>
                            )}

                            {/* 4. Month & Year Selectors */}
                            <div className="col-md-2 col-sm-6">
                                <label className="form-label small fw-semibold text-muted d-flex align-items-center gap-1 mb-1">
                                    <Calendar size={14} />
                                    Month
                                </label>
                                <select
                                    className="form-select form-select-sm"
                                    value={selectedMonth}
                                    onChange={(e) => setSelectedMonth(Number(e.target.value))}
                                >
                                    {MONTH_NAMES.map((name, idx) => (
                                        <option key={name} value={idx + 1}>
                                            {name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="col-md-2 col-sm-6">
                                <label className="form-label small fw-semibold text-muted d-flex align-items-center gap-1 mb-1">
                                    <Calendar size={14} />
                                    Year
                                </label>
                                <select
                                    className="form-select form-select-sm"
                                    value={selectedYear}
                                    onChange={(e) => setSelectedYear(Number(e.target.value))}
                                >
                                    {yearOptions.map((y) => (
                                        <option key={y} value={y}>
                                            {y}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* 5. User Type Filter Tabs */}
                            <div className="col-md-2 col-sm-6">
                                <label className="form-label small fw-semibold text-muted d-flex align-items-center gap-1 mb-1">
                                    <Users size={14} />
                                    User Type
                                </label>
                                <select
                                    className="form-select form-select-sm"
                                    value={userTypeFilter}
                                    onChange={(e) => setUserTypeFilter(e.target.value)}
                                >
                                    <option value="All">All Users ({users.length})</option>
                                    <option value="Player">Players Only</option>
                                    <option value="Staff">Staff / Coaches</option>
                                </select>
                            </div>
                        </div>

                        {/* Sub-bar: Search & Actions */}
                        <div className="row g-2 mt-2 pt-2 border-top align-items-center">
                            <div className="col-md-4 col-sm-6">
                                <div className="input-group input-group-sm">
                                    <span className="input-group-text bg-white">
                                        <Search size={14} className="text-muted" />
                                    </span>
                                    <input
                                        type="text"
                                        className="form-control"
                                        placeholder="Search by user name or ID..."
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

                            <div className="col-md-8 col-sm-6 d-flex flex-wrap justify-content-md-end align-items-center gap-2">
                                {selectedYear === currentYear && selectedMonth === currentMonth && (
                                    <button
                                        type="button"
                                        className="btn btn-sm btn-outline-success d-inline-flex align-items-center gap-1 fw-semibold"
                                        onClick={handleMarkAllTodayPresent}
                                        title="Mark all filtered users as Present for today"
                                    >
                                        <CheckCircle2 size={15} />
                                        Mark All Present Today ({todayDateStr})
                                    </button>
                                )}

                                <button
                                    type="button"
                                    className="btn btn-sm btn-outline-secondary d-inline-flex align-items-center gap-1"
                                    onClick={loadMatrixData}
                                    disabled={loadingData}
                                >
                                    <RefreshCw size={14} className={loadingData ? "spin" : ""} />
                                    Refresh
                                </button>
                            </div>
                        </div>
                    </>
                ) : (
                    /* Self Mode Filter Strip */
                    <div className="d-flex flex-wrap align-items-center justify-content-between gap-3">
                        <div className="d-flex align-items-center gap-3">
                            <div className="d-flex align-items-center gap-2">
                                <div
                                    className="rounded-circle d-flex align-items-center justify-content-center text-white fw-bold"
                                    style={{ width: "34px", height: "34px", backgroundColor: "#0d9488" }}
                                >
                                    {(user?.first_name || "U")[0]?.toUpperCase()}
                                </div>
                                <div>
                                    <strong className="text-dark d-block" style={{ fontSize: "0.9rem" }}>
                                        {user?.first_name} {user?.last_name || ""}
                                    </strong>
                                    <span className="text-muted small" style={{ fontSize: "0.75rem" }}>
                                        {user?.email || `User #${user?.id}`}
                                    </span>
                                </div>
                            </div>

                            <div className="border-start ps-3">
                                <span className="badge bg-primary-subtle text-primary border border-primary-subtle">
                                    {user?.user_type || "User"}
                                </span>
                            </div>
                        </div>

                        <div className="d-flex align-items-center gap-2 ms-auto">
                            <div className="d-flex align-items-center gap-1">
                                <label className="text-muted small mb-0 fw-semibold">Month:</label>
                                <select
                                    className="form-select form-select-sm"
                                    style={{ width: "120px" }}
                                    value={selectedMonth}
                                    onChange={(e) => setSelectedMonth(Number(e.target.value))}
                                >
                                    {MONTH_NAMES.map((name, idx) => (
                                        <option key={name} value={idx + 1}>
                                            {name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="d-flex align-items-center gap-1">
                                <label className="text-muted small mb-0 fw-semibold">Year:</label>
                                <select
                                    className="form-select form-select-sm"
                                    style={{ width: "90px" }}
                                    value={selectedYear}
                                    onChange={(e) => setSelectedYear(Number(e.target.value))}
                                >
                                    {yearOptions.map((y) => (
                                        <option key={y} value={y}>
                                            {y}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <button
                                type="button"
                                className="btn btn-sm btn-outline-secondary d-inline-flex align-items-center gap-1 ms-2"
                                onClick={loadMatrixData}
                                disabled={loadingData}
                            >
                                <RefreshCw size={14} className={loadingData ? "spin" : ""} />
                                Refresh
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Legend Bar */}
            <div className={styles.legendBar}>
                <span className="text-muted fw-bold me-2">Status Legend:</span>
                <span className={styles.legendItem}>
                    <span className="badge bg-success-subtle text-success border border-success-subtle">Present (P)</span>
                </span>
                <span className={styles.legendItem}>
                    <span className="badge bg-danger-subtle text-danger border border-danger-subtle">Absent (A)</span>
                </span>
                <span className={styles.legendItem}>
                    <span className="badge bg-warning-subtle text-warning-emphasis border border-warning-subtle">Late (L)</span>
                </span>
                <span className={styles.legendItem}>
                    <span className="badge bg-primary-subtle text-primary border border-primary-subtle">Half Day (HD)</span>
                </span>
                <span className={styles.legendItem}>
                    <span className="badge bg-secondary-subtle text-secondary border border-secondary-subtle">Leave (LV)</span>
                </span>
                <span className={styles.legendItem}>
                    <span
                        className="badge border"
                        style={{ backgroundColor: "#f3e8ff", color: "#7e22ce", borderColor: "#d8b4fe" }}
                    >
                        Week off (WO - Scheduled)
                    </span>
                </span>
                <span className="ms-auto text-muted small">
                    {isMasterAdmin
                        ? `Showing ${filteredUsers.length} of ${users.length} users • ${daysInMonth} Days`
                        : `Viewing My Monthly Attendance • ${daysInMonth} Days`}
                </span>
            </div>

            {/* Error Message */}
            {error && (
                <div className="alert alert-danger d-flex align-items-center gap-2 mb-3">
                    <AlertCircle size={18} />
                    <span>{error}</span>
                </div>
            )}

            {/* Matrix Table */}
            <div className={styles.tableWrapper}>
                {loadingData ? (
                    <div className="text-center py-5">
                        <Loader2 size={32} className="spin text-primary mb-2" />
                        <div className="text-muted fw-semibold">Loading attendance sheet...</div>
                    </div>
                ) : filteredUsers.length === 0 ? (
                    <div className="text-center py-5">
                        <Users size={36} className="text-muted opacity-50 mb-2" />
                        <h6 className="fw-bold text-dark">No records found</h6>
                        <p className="text-muted small mb-0">
                            {isMasterAdmin ? "No users match the selected branch and criteria." : "No attendance data available."}
                        </p>
                    </div>
                ) : (
                    <table className={styles.matrixTable}>
                        <thead>
                            <tr>
                                {/* Left Sticky Column: User Details */}
                                <th className={styles.stickyColHeader}>
                                    <div className="d-flex align-items-center justify-content-between">
                                        <span>{isMasterAdmin ? "User Name & Role" : "My Profile"}</span>
                                        <Users size={14} className="text-muted" />
                                    </div>
                                </th>

                                {/* Monthly Working Days & Summary Stats Header */}
                                <th className={styles.statsColHeader}>
                                    <span>Working Days &amp; Summary</span>
                                </th>

                                {/* 1 to 28/29/30/31 Day Columns */}
                                {daysArray.map((day) => {
                                    const dateObj = new Date(selectedYear, selectedMonth - 1, day);
                                    const dayOfWeek = WEEKDAY_NAMES[dateObj.getDay()];
                                    const isSunday = dateObj.getDay() === 0;
                                    const isToday =
                                        selectedYear === currentYear &&
                                        selectedMonth === currentMonth &&
                                        day === currentDay;

                                    return (
                                        <th
                                            key={day}
                                            className={`${styles.dayHeader} ${isToday ? styles.todayHeader : ""} ${
                                                isSunday ? styles.weekendHeader : ""
                                            }`}
                                        >
                                            <div className={styles.dayNum}>{day}</div>
                                            <div className={styles.dayName}>{dayOfWeek}</div>
                                        </th>
                                    );
                                })}
                            </tr>
                        </thead>

                        <tbody>
                            {filteredUsers.map((targetUser) => {
                                const stats = calculateUserStats(targetUser.id);
                                const isPlayer = String(targetUser.user_type || "").toLowerCase().includes("player");

                                return (
                                    <tr key={targetUser.id}>
                                        {/* Sticky User Column */}
                                        <td className={styles.stickyColCell}>
                                            <div className="d-flex align-items-center gap-2">
                                                <div
                                                    className="rounded-circle d-flex align-items-center justify-content-center text-white fw-bold"
                                                    style={{
                                                        width: "32px",
                                                        height: "32px",
                                                        minWidth: "32px",
                                                        backgroundColor: isPlayer ? "#0d9488" : "#4f46e5",
                                                        fontSize: "0.8rem",
                                                    }}
                                                >
                                                    {(targetUser.first_name || "U")[0]?.toUpperCase()}
                                                </div>
                                                <div className="text-truncate">
                                                    <div className="fw-bold text-dark text-truncate" title={`${targetUser.first_name} ${targetUser.last_name || ""}`}>
                                                        {targetUser.first_name} {targetUser.last_name || ""}
                                                    </div>
                                                    <div className="d-flex align-items-center gap-1 mt-0">
                                                        <span
                                                            className={`badge ${
                                                                isPlayer ? "bg-teal-subtle text-teal" : "bg-indigo-subtle text-indigo"
                                                            }`}
                                                            style={{
                                                                fontSize: "0.68rem",
                                                                backgroundColor: isPlayer ? "#ccfbf1" : "#e0e7ff",
                                                                color: isPlayer ? "#0f766e" : "#4338ca",
                                                            }}
                                                        >
                                                            {targetUser.user_type || "User"}
                                                        </span>
                                                        {targetUser.appointment_no && (
                                                            <span className="text-muted small" style={{ fontSize: "0.68rem" }}>
                                                                #{targetUser.appointment_no}
                                                            </span>
                                                        )}
                                                    </div>
                                                    {stats.dojStr && (
                                                        <div className="d-flex align-items-center gap-1 mt-1 text-muted" style={{ fontSize: "0.67rem" }}>
                                                            <span>DOJ: {stats.dojStr}</span>
                                                            {stats.isJoiningMonth && (
                                                                <span className="badge bg-warning-subtle text-warning-emphasis border" style={{ fontSize: "0.62rem" }}>
                                                                    Joined Day {stats.joiningDay}
                                                                </span>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </td>

                                        {/* Working Days & Summary Stats Column */}
                                        <td className={styles.statsColCell}>
                                            <div className={styles.statsContainer}>
                                                {stats.isNotEmployedYet ? (
                                                    <div className="text-center py-1">
                                                        <span className="badge bg-secondary-subtle text-secondary border" style={{ fontSize: "0.68rem" }}>
                                                            Not Employed
                                                        </span>
                                                        <div className="text-muted small mt-1" style={{ fontSize: "0.65rem" }}>
                                                            Joined {stats.dojStr}
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <>
                                                        <div className="d-flex align-items-center justify-content-between text-nowrap gap-1">
                                                            <span
                                                                className="text-dark fw-bold"
                                                                title={`Working Days: ${stats.totalWorkingDaysElapsed} / ${stats.totalElapsedDays} (Deductions: ${stats.totalDeductedDays}d)`}
                                                            >
                                                                WD: {stats.totalWorkingDaysElapsed} / {stats.totalElapsedDays}
                                                            </span>
                                                            <span
                                                                className="badge"
                                                                style={{ backgroundColor: "#f3e8ff", color: "#7e22ce", fontSize: "0.68rem" }}
                                                                title="Weekly offs included in working days (Paid)"
                                                            >
                                                                {stats.weekOffPastCount} WO
                                                            </span>
                                                        </div>
                                                        <div className="d-flex align-items-center justify-content-center gap-1 mt-1 text-nowrap" style={{ fontSize: "0.72rem" }}>
                                                            <span className="text-success fw-bold" title="Present">{stats.p}P</span>
                                                            <span className="text-muted">/</span>
                                                            <span className="text-danger fw-bold" title={`Absent (-${stats.a}d)`}>{stats.a}A</span>
                                                            {stats.l > 0 && (
                                                                <>
                                                                    <span className="text-muted">/</span>
                                                                    <span className="text-warning-emphasis fw-bold" title={`Late (-${(stats.l * 0.25).toFixed(2)}d)`}>{stats.l}L</span>
                                                                </>
                                                            )}
                                                            {stats.hd > 0 && (
                                                                <>
                                                                    <span className="text-muted">/</span>
                                                                    <span className="text-primary fw-bold" title={`Half Day (-${(stats.hd * 0.5).toFixed(1)}d)`}>{stats.hd}HD</span>
                                                                </>
                                                            )}
                                                            <span className="text-muted">/</span>
                                                            <span
                                                                className={`badge ${
                                                                    stats.percentage >= 75
                                                                        ? "bg-success"
                                                                        : stats.percentage >= 50
                                                                        ? "bg-warning text-dark"
                                                                        : "bg-danger"
                                                                }`}
                                                                style={{ fontSize: "0.68rem" }}
                                                                title="Working % (Week offs paid)"
                                                            >
                                                                {stats.percentage}%
                                                            </span>
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                        </td>

                                        {/* Date Dropdown Cells */}
                                        {daysArray.map((day) => {
                                            const dateObj = new Date(selectedYear, selectedMonth - 1, day);
                                            const weekday = FULL_WEEKDAY_NAMES[dateObj.getDay()];
                                            const userDays = weeklyOffMap[targetUser.id] || [];
                                            const isWeeklyOff = userDays.includes(weekday);
                                            const isSunday = dateObj.getDay() === 0;
                                            const isToday =
                                                selectedYear === currentYear &&
                                                selectedMonth === currentMonth &&
                                                day === currentDay;

                                            // Date of Joining: Days prior to DOJ in first month or in past un-employed months
                                            const isPriorToJoin = stats.isNotEmployedYet || (stats.isJoiningMonth && day < stats.joiningDay);
                                            if (isPriorToJoin) {
                                                return (
                                                    <td
                                                        key={day}
                                                        className={`${isToday ? styles.todayCol : ""} text-center`}
                                                        style={{ backgroundColor: "#f8fafc", opacity: 0.65 }}
                                                    >
                                                        <span
                                                            className="badge bg-light text-muted border"
                                                            style={{ fontSize: "0.64rem", padding: "2px 4px", fontWeight: "normal" }}
                                                            title={stats.isNotEmployedYet ? `Joined on ${stats.dojStr}. Not yet employed in ${MONTH_NAMES[selectedMonth - 1]} ${selectedYear}.` : `Joined on ${stats.dojStr}. Day ${day} is prior to joining date.`}
                                                        >
                                                            -
                                                        </span>
                                                    </td>
                                                );
                                            }

                                            const dateStr = `${selectedYear}-${String(selectedMonth).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                                            const cellKey = `${targetUser.id}_${dateStr}`;
                                            const recordedStatus = attendanceMap[cellKey];
                                            const savingStatus = savingStates[cellKey];

                                            // If it is weekly off AND no manual override status (like Present, Leave, etc.) has been saved
                                            if (isWeeklyOff && !recordedStatus) {
                                                return (
                                                    <td
                                                        key={day}
                                                        className={`${isToday ? styles.todayCol : ""} ${styles.weekendCol}`}
                                                    >
                                                        <div
                                                            className={styles.weekOffBadge}
                                                            title={`${targetUser.first_name} - Weekly Off (${weekday}) [Defined in Weekly Off Schedule]`}
                                                        >
                                                            WO
                                                        </div>
                                                    </td>
                                                );
                                            }

                                            // Regular working day or overridden day
                                            const currentStatus = recordedStatus || "";
                                            let statusClass = styles.statusEmpty;
                                            if (currentStatus === "Present") statusClass = styles.statusPresent;
                                            else if (currentStatus === "Absent") statusClass = styles.statusAbsent;
                                            else if (currentStatus === "Late") statusClass = styles.statusLate;
                                            else if (currentStatus === "Half Day") statusClass = styles.statusHalfDay;
                                            else if (currentStatus === "Leave") statusClass = styles.statusLeave;

                                            return (
                                                <td
                                                    key={day}
                                                    className={`${isToday ? styles.todayCol : ""} ${
                                                        isSunday ? styles.weekendCol : ""
                                                    }`}
                                                >
                                                    <div className="position-relative">
                                                        <select
                                                            className={`${styles.statusSelect} ${statusClass}`}
                                                            value={currentStatus}
                                                            onChange={(e) =>
                                                                handleStatusChange(targetUser, day, e.target.value)
                                                            }
                                                            aria-label={`Attendance for ${targetUser.first_name} on day ${day}`}
                                                        >
                                                            {ATTENDANCE_OPTIONS.map((opt) => (
                                                                <option key={opt.value} value={opt.value}>
                                                                    {opt.label}
                                                                </option>
                                                            ))}
                                                        </select>

                                                        {/* Saving Spinner Indicator */}
                                                        {savingStatus === "saving" && (
                                                            <div className={styles.savingIndicator}>
                                                                <Loader2 size={10} className="spin" />
                                                            </div>
                                                        )}
                                                        {savingStatus === "saved" && (
                                                            <div className="text-success" style={{ fontSize: "0.65rem" }}>
                                                                <Check size={10} />
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>
                                            );
                                        })}
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
