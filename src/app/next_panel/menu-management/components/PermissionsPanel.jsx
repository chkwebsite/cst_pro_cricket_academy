"use client";

import { useEffect, useState } from "react";
import { KeyIcon, PlusIcon, XIcon } from "./Icon";
import {
    createMenuPermission,
    deleteMenuPermission,
    listMenuPermissions,
    listPermissions,
} from "../lib/api";
import styles from "../styles.module.css";

export default function PermissionsPanel({ menu, onNotify }) {
    const [links, setLinks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const [catalog, setCatalog] = useState(null); // null = not loaded yet, [] = loaded but empty/unavailable
    const [catalogFailed, setCatalogFailed] = useState(false);

    const [selectedPermissionId, setSelectedPermissionId] = useState("");
    const [manualPermissionId, setManualPermissionId] = useState("");
    const [adding, setAdding] = useState(false);
    const [removingId, setRemovingId] = useState(null);

    useEffect(() => {
        let cancelled = false;

        setLoading(true);
        setError("");

        listMenuPermissions(menu.id)
            .then((res) => {
                if (!cancelled) setLinks(res.data || []);
            })
            .catch((err) => {
                if (!cancelled) setError(err.message);
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [menu.id]);

    // Load the permission catalog once, for the "add" dropdown. If the
    // /api/permissions route isn't present in this project yet, fall back
    // to a manual permission_id field instead of blocking the feature.
    useEffect(() => {
        let cancelled = false;

        listPermissions()
            .then((res) => {
                if (!cancelled) setCatalog(res.data || []);
            })
            .catch(() => {
                if (!cancelled) {
                    setCatalog([]);
                    setCatalogFailed(true);
                }
            });

        return () => {
            cancelled = true;
        };
    }, []);

    const linkedIds = new Set(links.map((l) => l.permission_id));
    const availableOptions = (catalog || []).filter((p) => !linkedIds.has(p.id));

    const handleAdd = async (e) => {
        e.preventDefault();

        const permissionId = catalogFailed ? manualPermissionId : selectedPermissionId;
        if (!permissionId) return;

        setAdding(true);
        try {
            const res = await createMenuPermission({
                menu_id: menu.id,
                permission_id: Number(permissionId),
            });

            const matchedCatalog = (catalog || []).find((p) => p.id === Number(permissionId));

            setLinks((prev) => [
                {
                    id: res.data.id,
                    menu_id: menu.id,
                    permission_id: Number(permissionId),
                    module_name: matchedCatalog?.module_name,
                    permission_name: matchedCatalog?.permission_name,
                },
                ...prev,
            ]);

            setSelectedPermissionId("");
            setManualPermissionId("");
            onNotify?.("Permission assigned");
        } catch (err) {
            onNotify?.(err.message, true);
        } finally {
            setAdding(false);
        }
    };

    const handleRemove = async (link) => {
        setRemovingId(link.id);
        try {
            await deleteMenuPermission(link.id);
            setLinks((prev) => prev.filter((l) => l.id !== link.id));
            onNotify?.("Permission removed");
        } catch (err) {
            onNotify?.(err.message, true);
        } finally {
            setRemovingId(null);
        }
    };

    return (
        <div className={styles.section}>
            <div className={styles.sectionHead}>
                <h2>Permissions</h2>
                <span className={styles.formHint}>{links.length} assigned</span>
            </div>

            {loading && <div className={styles.permEmpty}>Loading…</div>}
            {!loading && error && <div className={styles.errorText}>{error}</div>}

            {!loading && !error && (
                <>
                    {links.length === 0 ? (
                        <div className={styles.permEmpty}>
                            No permissions are wired to this menu yet — anyone who can see it will see it
                            unrestricted.
                        </div>
                    ) : (
                        <div className={styles.permList}>
                            {links.map((link) => (
                                <span key={link.id} className={styles.permChip}>
                                    <KeyIcon />
                                    <span className={styles.mono}>
                                        {link.module_name || `#${link.permission_id}`}
                                    </span>
                                    {link.permission_name && (
                                        <span className={styles.permChipKey}>{link.permission_name}</span>
                                    )}
                                    <button
                                        className={styles.permChipRemove}
                                        onClick={() => handleRemove(link)}
                                        disabled={removingId === link.id}
                                        aria-label={`Remove ${link.module_name || link.permission_id}`}
                                        title="Remove"
                                    >
                                        <XIcon size={10} />
                                    </button>
                                </span>
                            ))}
                        </div>
                    )}

                    <form className={styles.addPermRow} onSubmit={handleAdd}>
                        {catalogFailed ? (
                            <input
                                className={styles.mono}
                                placeholder="permission_id"
                                value={manualPermissionId}
                                onChange={(e) => setManualPermissionId(e.target.value)}
                                inputMode="numeric"
                            />
                        ) : (
                            <select
                                value={selectedPermissionId}
                                onChange={(e) => setSelectedPermissionId(e.target.value)}
                                disabled={catalog === null}
                            >
                                <option value="">
                                    {catalog === null
                                        ? "Loading permissions…"
                                        : availableOptions.length === 0
                                        ? "All permissions already assigned"
                                        : "Select a permission to add…"}
                                </option>
                                {availableOptions.map((p) => (
                                    <option key={p.id} value={p.id}>
                                        {p.module_name} — {p.permission_name}
                                    </option>
                                ))}
                            </select>
                        )}

                        <button
                            type="submit"
                            className={`${styles.btn} ${styles.btnGhost}`}
                            disabled={
                                adding || (catalogFailed ? !manualPermissionId : !selectedPermissionId)
                            }
                        >
                            <PlusIcon />
                            Add
                        </button>
                    </form>

                    {catalogFailed && (
                        <div className={styles.formHint} style={{ marginTop: 8 }}>
                            Couldn&apos;t load the permission catalog from /api/permissions, so permission_id
                            can be entered directly.
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
