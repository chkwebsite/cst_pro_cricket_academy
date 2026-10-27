"use client";

import { useCallback, useEffect, useState } from "react";
import MenuTree from "./components/MenuTree";
import MenuFormModal from "./components/MenuFormModal";
import ConfirmDialog from "./components/ConfirmDialog";
import PermissionsPanel from "./components/PermissionsPanel";
import { EditIcon, PlusIcon, SearchIcon, TrashIcon, LayersIcon, AlertIcon } from "./components/Icon";
import { createMenu, deleteMenu, listMenus, updateMenu } from "./lib/api";
import styles from "./styles.module.css";

export default function MenuManagementPage() {
    const [menus, setMenus] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState("");

    const [search, setSearch] = useState("");
    const [activeId, setActiveId] = useState(null);

    const [modal, setModal] = useState(null); // { mode: "create" | "edit", menu? }
    const [confirmTarget, setConfirmTarget] = useState(null); // menu pending delete

    const [toast, setToast] = useState(null); // { message, isError }

    const notify = useCallback((message, isError = false) => {
        setToast({ message, isError });
        window.clearTimeout(notify._t);
        notify._t = window.setTimeout(() => setToast(null), 3200);
    }, []);

    const fetchMenus = useCallback(async () => {
        setLoading(true);
        setLoadError("");
        try {
            const res = await listMenus();
            setMenus(res.data || []);
        } catch (err) {
            setLoadError(err.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchMenus();
    }, [fetchMenus]);

    const activeMenu = menus.find((m) => m.id === activeId) || null;

    const handleCreate = async (payload) => {
        const res = await createMenu(payload);
        await fetchMenus();
        setModal(null);
        setActiveId(res.data.id);
        notify("Menu created");
    };

    const handleUpdate = async (payload) => {
        await updateMenu(modal.menu.id, payload);
        await fetchMenus();
        setModal(null);
        notify("Menu updated");
    };

    const handleDelete = async () => {
        await deleteMenu(confirmTarget.id);
        await fetchMenus();
        if (activeId === confirmTarget.id) setActiveId(null);
        setConfirmTarget(null);
        notify("Menu deleted");
    };

    const parentMenu = activeMenu?.parent_id
        ? menus.find((m) => m.id === activeMenu.parent_id)
        : null;

    return (
        <div className={styles.root}>
            <header className={styles.topbar}>
                <div className={styles.titleBlock}>
                    <h1>Menu &amp; permissions</h1>
                    <p>Manage the navigation tree and the permission keys wired to each item.</p>
                </div>
                <div className={styles.topbarActions}>
                    <div className={styles.searchBox}>
                        <SearchIcon />
                        <input
                            placeholder="Search menus…"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                    <button
                        className={`${styles.btn} ${styles.btnPrimary}`}
                        onClick={() => setModal({ mode: "create" })}
                    >
                        <PlusIcon />
                        New menu
                    </button>
                </div>
            </header>

            <div className={styles.body}>
                <aside className={styles.treePanel}>
                    <div className={styles.treeHint}>{menus.length} menus</div>
                    <div className={styles.treeScroll}>
                        {loading && <div className={styles.emptyTree}>Loading…</div>}
                        {!loading && loadError && (
                            <div className={styles.permEmpty}>
                                <AlertIcon />
                                <div style={{ marginTop: 8 }}>{loadError}</div>
                            </div>
                        )}
                        {!loading && !loadError && (
                            <MenuTree
                                menus={menus}
                                activeId={activeId}
                                onSelect={setActiveId}
                                searchTerm={search}
                            />
                        )}
                    </div>
                </aside>

                <main className={styles.detailPanel}>
                    {!activeMenu && (
                        <div className={styles.placeholder}>
                            <LayersIcon size={22} />
                            <span>Select a menu on the left, or create a new one.</span>
                        </div>
                    )}

                    {activeMenu && (
                        <>
                            <div className={styles.detailHeader}>
                                <div>
                                    {parentMenu && (
                                        <div className={styles.crumb}>
                                            {parentMenu.menu_title || parentMenu.menu_name} /
                                        </div>
                                    )}
                                    <div className={styles.detailTitle}>
                                        <h1>{activeMenu.menu_title}</h1>
                                        <span
                                            className={`${styles.pill} ${
                                                activeMenu.is_active ? styles.pillOn : styles.pillOff
                                            }`}
                                        >
                                            {activeMenu.is_active ? "Active" : "Inactive"}
                                        </span>
                                        <span
                                            className={`${styles.pill} ${
                                                activeMenu.status ? styles.pillOn : styles.pillOff
                                            }`}
                                        >
                                            {activeMenu.status ? "Enabled" : "Disabled"}
                                        </span>
                                    </div>
                                </div>
                                <div className={styles.detailActions}>
                                    <button
                                        className={`${styles.btn} ${styles.btnGhost}`}
                                        onClick={() => setModal({ mode: "edit", menu: activeMenu })}
                                    >
                                        <EditIcon />
                                        Edit
                                    </button>
                                    <button
                                        className={`${styles.btn} ${styles.btnDanger}`}
                                        onClick={() => setConfirmTarget(activeMenu)}
                                    >
                                        <TrashIcon />
                                        Delete
                                    </button>
                                </div>
                            </div>

                            <div className={styles.section}>
                                <div className={styles.sectionHead}>
                                    <h2>Details</h2>
                                </div>
                                <div className={styles.fieldGrid}>
                                    <Field label="menu_key" mono value={activeMenu.menu_key} />
                                    <Field label="menu_name" value={activeMenu.menu_name} />
                                    <Field label="menu_type" value={activeMenu.menu_type} />
                                    <Field label="menu_order" value={String(activeMenu.menu_order)} />
                                    <Field label="menu_url" mono value={activeMenu.menu_url} empty="—" />
                                    <Field label="menu_icon" value={activeMenu.menu_icon} empty="—" />
                                    <Field
                                        label="Sidebar"
                                        value={activeMenu.is_sidebar ? "Shown" : "Hidden"}
                                    />
                                    <Field
                                        label="Parent"
                                        value={parentMenu ? parentMenu.menu_title || parentMenu.menu_name : null}
                                        empty="Top level"
                                    />
                                </div>
                            </div>

                            <PermissionsPanel menu={activeMenu} onNotify={notify} />
                        </>
                    )}
                </main>
            </div>

            {modal && (
                <MenuFormModal
                    menu={modal.mode === "edit" ? modal.menu : null}
                    menus={menus}
                    onClose={() => setModal(null)}
                    onSubmit={modal.mode === "edit" ? handleUpdate : handleCreate}
                />
            )}

            {confirmTarget && (
                <ConfirmDialog
                    title="Delete menu"
                    message={`"${confirmTarget.menu_title || confirmTarget.menu_name}" will be soft-deleted and hidden from the navigation. This can be reversed in the database if needed.`}
                    confirmLabel="Delete menu"
                    onConfirm={handleDelete}
                    onClose={() => setConfirmTarget(null)}
                />
            )}

            {toast && (
                <div className={`${styles.toast} ${toast.isError ? styles.toastError : ""}`}>
                    {toast.message}
                </div>
            )}
        </div>
    );
}

function Field({ label, value, mono, empty = "—" }) {
    return (
        <div className={styles.field}>
            <label>{label}</label>
            <div
                className={`${styles.fieldValue} ${mono ? styles.mono : ""} ${
                    !value ? styles.fieldValueMuted : ""
                }`}
            >
                {value || empty}
            </div>
        </div>
    );
}
