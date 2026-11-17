"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTrialModal } from "./TrialModalContext";
import { Calendar, MapPin, Building2, ArrowRight, X, AlertCircle } from "lucide-react";

export default function TrialSelectionModal() {
    const { isOpen, closeModal } = useTrialModal();
    const router = useRouter();

    const [academies, setAcademies] = useState([]);
    const [branches, setBranches] = useState([]);
    const [selectedAcademy, setSelectedAcademy] = useState("");
    const [selectedBranch, setSelectedBranch] = useState("");

    const [loadingAcademies, setLoadingAcademies] = useState(false);
    const [loadingBranches, setLoadingBranches] = useState(false);
    const [errorMsg, setErrorMsg] = useState("");

    // Load active academies when modal opens
    useEffect(() => {
        if (!isOpen) return;

        let isMounted = true;
        setLoadingAcademies(true);
        setErrorMsg("");

        fetch("/api/academies?status=1")
            .then((res) => res.json())
            .then((json) => {
                if (isMounted && json.success && Array.isArray(json.data)) {
                    setAcademies(json.data);
                    // Preselect first academy if none selected
                    if (!selectedAcademy && json.data.length > 0) {
                        setSelectedAcademy(String(json.data[0].id));
                    }
                }
            })
            .catch((err) => {
                if (isMounted) {
                    console.error("Error loading academies:", err);
                    setErrorMsg("Unable to load academies. Please try again.");
                }
            })
            .finally(() => {
                if (isMounted) setLoadingAcademies(false);
            });

        return () => {
            isMounted = false;
        };
    }, [isOpen]);

    // Fetch branches whenever selectedAcademy changes
    useEffect(() => {
        if (!selectedAcademy) {
            setBranches([]);
            setSelectedBranch("");
            return;
        }

        let isMounted = true;
        setLoadingBranches(true);

        fetch(`/api/branch?status=1&academy_id=${selectedAcademy}`)
            .then((res) => res.json())
            .then((json) => {
                if (isMounted && json.success && Array.isArray(json.data)) {
                    setBranches(json.data);
                    if (json.data.length > 0) {
                        setSelectedBranch(String(json.data[0].id));
                    } else {
                        setSelectedBranch("");
                    }
                }
            })
            .catch((err) => {
                if (isMounted) {
                    console.error("Error loading branches:", err);
                    setBranches([]);
                    setSelectedBranch("");
                }
            })
            .finally(() => {
                if (isMounted) setLoadingBranches(false);
            });

        return () => {
            isMounted = false;
        };
    }, [selectedAcademy]);

    // Handle ESC key to close
    useEffect(() => {
        if (!isOpen) return;
        const handleKeyDown = (e) => {
            if (e.key === "Escape") closeModal();
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [isOpen, closeModal]);

    if (!isOpen) return null;

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!selectedAcademy) {
            setErrorMsg("Please select an academy.");
            return;
        }
        if (!selectedBranch) {
            setErrorMsg("Please select a campus / branch.");
            return;
        }

        closeModal();
        router.push(`/book-free-trial?academy_id=${selectedAcademy}&branch_id=${selectedBranch}`);
    };

    const currentAcademyObj = academies.find((a) => String(a.id) === String(selectedAcademy));
    const currentBranchObj = branches.find((b) => String(b.id) === String(selectedBranch));

    return (
        <div
            className="modal-backdrop-custom position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center p-3"
            style={{
                backgroundColor: "rgba(6, 20, 27, 0.78)",
                backdropFilter: "blur(6px)",
                zIndex: 99999,
                animation: "fadeIn 0.2s ease-in-out",
            }}
            onClick={(e) => {
                if (e.target === e.currentTarget) closeModal();
            }}
        >
            <div
                className="modal-card bg-white rounded-4 shadow-lg overflow-hidden position-relative"
                style={{
                    width: "100%",
                    maxWidth: "520px",
                    border: "1px solid rgba(255, 255, 255, 0.2)",
                    animation: "scaleIn 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
                }}
            >
                {/* Header with Dark Red/Navy Gradient */}
                <div
                    className="p-4 text-white position-relative"
                    style={{
                        background: "linear-gradient(135deg, #062f38 0%, #0d4b57 100%)",
                        borderBottom: "3px solid var(--red, #e10600)",
                    }}
                >
                    <button
                        type="button"
                        onClick={closeModal}
                        aria-label="Close modal"
                        className="btn-close btn-close-white position-absolute top-0 end-0 m-3"
                        style={{ opacity: 0.8 }}
                    />
                    <div className="d-flex align-items-center gap-3">
                        <div
                            className="d-flex align-items-center justify-content-center rounded-3"
                            style={{
                                width: "46px",
                                height: "46px",
                                background: "rgba(225, 6, 0, 0.2)",
                                border: "1px solid rgba(225, 6, 0, 0.4)",
                                color: "#ff4d4d",
                            }}
                        >
                            <Calendar size={24} />
                        </div>
                        <div>
                            <span
                                className="badge text-uppercase fw-bold mb-1"
                                style={{
                                    background: "rgba(255, 255, 255, 0.15)",
                                    fontSize: "0.7rem",
                                    letterSpacing: "0.5px",
                                    color: "#a4e2ec",
                                }}
                            >
                                Free 1-Day Trial
                            </span>
                            <h4 className="fw-bold mb-0 text-white font-oswald text-uppercase" style={{ letterSpacing: "0.5px" }}>
                                Choose Academy & Campus
                            </h4>
                        </div>
                    </div>
                    <p className="small text-white-50 mt-2 mb-0" style={{ lineHeight: "1.4" }}>
                        Select your preferred academy location to proceed with your free cricket trial booking.
                    </p>
                </div>

                {/* Form Body */}
                <form onSubmit={handleSubmit} className="p-4">
                    {errorMsg && (
                        <div className="alert alert-danger py-2 px-3 small rounded-3 d-flex align-items-center gap-2 mb-3">
                            <AlertCircle size={16} className="flex-shrink-0" />
                            <span>{errorMsg}</span>
                        </div>
                    )}

                    {/* Step 1: Academy Selection */}
                    <div className="mb-3">
                        <label className="form-label small fw-bold text-dark d-flex align-items-center gap-2 mb-1">
                            <Building2 size={16} className="text-danger" />
                            <span>1. Select Academy</span>
                            <span className="text-danger">*</span>
                        </label>
                        <select
                            className="form-select form-select-lg py-2 fs-6"
                            value={selectedAcademy}
                            onChange={(e) => {
                                setSelectedAcademy(e.target.value);
                                setErrorMsg("");
                            }}
                            disabled={loadingAcademies}
                            required
                        >
                            <option value="">
                                {loadingAcademies ? "Loading academies..." : "Select an Academy..."}
                            </option>
                            {academies.map((a) => (
                                <option key={a.id} value={a.id}>
                                    {a.academy_name} {a.city ? `(${a.city})` : ""}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Step 2: Branch Selection */}
                    <div className="mb-3">
                        <label className="form-label small fw-bold text-dark d-flex align-items-center gap-2 mb-1">
                            <MapPin size={16} className="text-danger" />
                            <span>2. Select Preferred Branch / Campus</span>
                            <span className="text-danger">*</span>
                        </label>
                        <select
                            className="form-select form-select-lg py-2 fs-6"
                            value={selectedBranch}
                            onChange={(e) => {
                                setSelectedBranch(e.target.value);
                                setErrorMsg("");
                            }}
                            disabled={!selectedAcademy || loadingBranches}
                            required
                        >
                            <option value="">
                                {!selectedAcademy
                                    ? "Please select an academy first"
                                    : loadingBranches
                                    ? "Loading branches..."
                                    : branches.length === 0
                                    ? "No active branches found"
                                    : "Select a Branch / Campus..."}
                            </option>
                            {branches.map((b) => (
                                <option key={b.id} value={b.id}>
                                    {b.branch_name} {b.city ? `(${b.city})` : ""}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Summary box when selected */}
                    {currentAcademyObj && currentBranchObj && (
                        <div
                            className="p-3 rounded-3 mb-3 small d-flex align-items-center gap-2"
                            style={{ background: "#f0f9f8", border: "1px solid #c7ece7" }}
                        >
                            <MapPin size={18} className="text-success flex-shrink-0" />
                            <div>
                                <span className="text-muted">Booking at: </span>
                                <strong className="text-dark">{currentBranchObj.branch_name}</strong>
                                <span className="text-muted"> ({currentAcademyObj.academy_name})</span>
                            </div>
                        </div>
                    )}

                    {/* Action Buttons */}
                    <div className="d-flex justify-content-end gap-2 pt-2 border-top">
                        <button
                            type="button"
                            className="btn btn-outline-secondary px-3"
                            onClick={closeModal}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="btn btn--red d-inline-flex align-items-center gap-2 px-4 fw-bold"
                            style={{
                                background: "var(--red, #e10600)",
                                color: "#fff",
                                border: "none",
                                borderRadius: "8px",
                                padding: "10px 20px",
                            }}
                            disabled={!selectedAcademy || !selectedBranch || loadingBranches}
                        >
                            <span>Proceed to Book Trial</span>
                            <ArrowRight size={16} />
                        </button>
                    </div>
                </form>
            </div>

            <style jsx>{`
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes scaleIn {
                    from { transform: scale(0.95); opacity: 0; }
                    to { transform: scale(1); opacity: 1; }
                }
            `}</style>
        </div>
    );
}
