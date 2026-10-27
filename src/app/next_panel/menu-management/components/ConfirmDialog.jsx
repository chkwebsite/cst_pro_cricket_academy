"use client";

import { useState } from "react";
import styles from "../styles.module.css";

export default function ConfirmDialog({ title, message, confirmLabel = "Delete", onConfirm, onClose }) {
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");

    const handleConfirm = async () => {
        setBusy(true);
        setError("");
        try {
            await onConfirm();
        } catch (err) {
            setError(err.message || "Something went wrong");
            setBusy(false);
        }
    };

    return (
        <div className={styles.overlay} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
            <div className={`${styles.modal} ${styles.confirmModal}`}>
                <div className={styles.modalHead}>
                    <h2>{title}</h2>
                </div>
                <div className={styles.confirmBody}>
                    <p>{message}</p>
                    {error && <div className={styles.errorText}>{error}</div>}
                </div>
                <div className={styles.modalFoot}>
                    <button className={`${styles.btn} ${styles.btnGhost}`} onClick={onClose} disabled={busy}>
                        Cancel
                    </button>
                    <button className={`${styles.btn} ${styles.btnDanger}`} onClick={handleConfirm} disabled={busy}>
                        {busy ? "Working…" : confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
}
