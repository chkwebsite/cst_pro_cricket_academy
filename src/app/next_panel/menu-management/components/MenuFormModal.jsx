"use client";

import { useMemo, useState } from "react";
import { XIcon, AlertIcon } from "./Icon";
import styles from "../styles.module.css";

const MENU_TYPES = ["module", "link", "heading"];

const emptyForm = {
    parent_id: "",
    menu_key: "",
    menu_name: "",
    menu_title: "",
    menu_icon: "",
    menu_url: "",
    menu_type: "module",
    menu_order: 0,
    is_sidebar: true,
    is_active: true,
    status: true,
};

// menus: flat list, used to populate the parent dropdown (and to exclude
// the menu being edited plus its own descendants, so it can't become its
// own ancestor).
export default function MenuFormModal({ menu, menus, onClose, onSubmit }) {
    const isEdit = Boolean(menu);

    const [form, setForm] = useState(() =>
        isEdit
            ? {
                  parent_id: menu.parent_id ?? "",
                  menu_key: menu.menu_key ?? "",
                  menu_name: menu.menu_name ?? "",
                  menu_title: menu.menu_title ?? "",
                  menu_icon: menu.menu_icon ?? "",
                  menu_url: menu.menu_url ?? "",
                  menu_type: menu.menu_type ?? "module",
                  menu_order: menu.menu_order ?? 0,
                  is_sidebar: Boolean(menu.is_sidebar),
                  is_active: Boolean(menu.is_active),
                  status: Boolean(menu.status),
              }
            : emptyForm
    );

    const [fieldErrors, setFieldErrors] = useState({});
    const [formError, setFormError] = useState("");
    const [saving, setSaving] = useState(false);

    const excludedParentIds = useMemo(
        () => getDescendantIds(isEdit ? menu.id : null, menus),
        [isEdit, menu, menus]
    );

    const update = (key, value) => {
        setForm((prev) => ({ ...prev, [key]: value }));
        setFieldErrors((prev) => ({ ...prev, [key]: undefined }));
    };

    const validate = () => {
        const errors = {};
        if (!form.menu_key.trim()) errors.menu_key = "menu_key is required";
        else if (!/^[a-zA-Z0-9_.-]+$/.test(form.menu_key.trim()))
            errors.menu_key = "Use letters, numbers, _ . - only";
        if (!form.menu_name.trim()) errors.menu_name = "menu_name is required";
        if (!form.menu_title.trim()) errors.menu_title = "menu_title is required";
        return errors;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const errors = validate();
        if (Object.keys(errors).length > 0) {
            setFieldErrors(errors);
            return;
        }

        setSaving(true);
        setFormError("");

        try {
            await onSubmit({
                parent_id: form.parent_id === "" ? null : Number(form.parent_id),
                menu_key: form.menu_key.trim(),
                menu_name: form.menu_name.trim(),
                menu_title: form.menu_title.trim(),
                menu_icon: form.menu_icon.trim() || null,
                menu_url: form.menu_url.trim() || null,
                menu_type: form.menu_type,
                menu_order: Number(form.menu_order) || 0,
                is_sidebar: form.is_sidebar ? 1 : 0,
                is_active: form.is_active ? 1 : 0,
                status: form.status ? 1 : 0,
            });
        } catch (err) {
            setFormError(err.message || "Something went wrong");
            setSaving(false);
            return;
        }

        setSaving(false);
    };

    return (
        <div className={styles.overlay} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
            <div className={styles.modal}>
                <div className={styles.modalHead}>
                    <h2>{isEdit ? `Edit ${menu.menu_name}` : "New menu"}</h2>
                    <button className={styles.iconBtn} onClick={onClose} aria-label="Close">
                        <XIcon />
                    </button>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className={styles.modalBody}>
                        {formError && (
                            <div className={styles.formError}>
                                <AlertIcon size={14} />
                                <span>{formError}</span>
                            </div>
                        )}

                        <div className={styles.fieldGrid}>
                            <div className={styles.formField}>
                                <label htmlFor="menu_key">
                                    menu_key <span className={styles.mono}>*</span>
                                </label>
                                <input
                                    id="menu_key"
                                    className={`${styles.input} ${styles.mono} ${
                                        fieldErrors.menu_key ? styles.inputError : ""
                                    }`}
                                    value={form.menu_key}
                                    onChange={(e) => update("menu_key", e.target.value)}
                                    placeholder="dashboard.overview"
                                    disabled={saving}
                                />
                                {fieldErrors.menu_key && (
                                    <div className={styles.errorText}>{fieldErrors.menu_key}</div>
                                )}
                            </div>

                            <div className={styles.formField}>
                                <label htmlFor="menu_type">menu_type</label>
                                <select
                                    id="menu_type"
                                    className={styles.select}
                                    value={form.menu_type}
                                    onChange={(e) => update("menu_type", e.target.value)}
                                    disabled={saving}
                                >
                                    {MENU_TYPES.map((t) => (
                                        <option key={t} value={t}>
                                            {t}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className={styles.formField}>
                                <label htmlFor="menu_name">menu_name *</label>
                                <input
                                    id="menu_name"
                                    className={`${styles.input} ${
                                        fieldErrors.menu_name ? styles.inputError : ""
                                    }`}
                                    value={form.menu_name}
                                    onChange={(e) => update("menu_name", e.target.value)}
                                    placeholder="Overview"
                                    disabled={saving}
                                />
                                {fieldErrors.menu_name && (
                                    <div className={styles.errorText}>{fieldErrors.menu_name}</div>
                                )}
                            </div>

                            <div className={styles.formField}>
                                <label htmlFor="menu_title">menu_title *</label>
                                <input
                                    id="menu_title"
                                    className={`${styles.input} ${
                                        fieldErrors.menu_title ? styles.inputError : ""
                                    }`}
                                    value={form.menu_title}
                                    onChange={(e) => update("menu_title", e.target.value)}
                                    placeholder="Dashboard overview"
                                    disabled={saving}
                                />
                                {fieldErrors.menu_title && (
                                    <div className={styles.errorText}>{fieldErrors.menu_title}</div>
                                )}
                            </div>

                            <div className={`${styles.formField} ${styles.fieldFull}`}>
                                <label htmlFor="parent_id">Parent menu</label>
                                <select
                                    id="parent_id"
                                    className={styles.select}
                                    value={form.parent_id}
                                    onChange={(e) => update("parent_id", e.target.value)}
                                    disabled={saving}
                                >
                                    <option value="">— None (top level) —</option>
                                    {menus
                                        .filter((m) => !excludedParentIds.has(m.id))
                                        .map((m) => (
                                            <option key={m.id} value={m.id}>
                                                {m.menu_title || m.menu_name}
                                            </option>
                                        ))}
                                </select>
                                <div className={styles.formHint}>
                                    A menu can&apos;t be its own parent or a descendant&apos;s parent.
                                </div>
                            </div>

                            <div className={styles.formField}>
                                <label htmlFor="menu_url">menu_url</label>
                                <input
                                    id="menu_url"
                                    className={`${styles.input} ${styles.mono}`}
                                    value={form.menu_url}
                                    onChange={(e) => update("menu_url", e.target.value)}
                                    placeholder="/dashboard"
                                    disabled={saving}
                                />
                            </div>

                            <div className={styles.formField}>
                                <label htmlFor="menu_icon">menu_icon</label>
                                <input
                                    id="menu_icon"
                                    className={styles.input}
                                    value={form.menu_icon}
                                    onChange={(e) => update("menu_icon", e.target.value)}
                                    placeholder="layout-dashboard"
                                    disabled={saving}
                                />
                            </div>

                            <div className={styles.formField}>
                                <label htmlFor="menu_order">menu_order</label>
                                <input
                                    id="menu_order"
                                    type="number"
                                    className={styles.input}
                                    value={form.menu_order}
                                    onChange={(e) => update("menu_order", e.target.value)}
                                    disabled={saving}
                                />
                            </div>

                            <div className={styles.formField}>
                                <label>Flags</label>
                                <div style={{ display: "flex", flexDirection: "column", gap: 8, paddingTop: 4 }}>
                                    <label className={styles.checkboxRow}>
                                        <input
                                            type="checkbox"
                                            checked={form.is_sidebar}
                                            onChange={(e) => update("is_sidebar", e.target.checked)}
                                            disabled={saving}
                                        />
                                        Show in sidebar
                                    </label>
                                    <label className={styles.checkboxRow}>
                                        <input
                                            type="checkbox"
                                            checked={form.is_active}
                                            onChange={(e) => update("is_active", e.target.checked)}
                                            disabled={saving}
                                        />
                                        Active
                                    </label>
                                    <label className={styles.checkboxRow}>
                                        <input
                                            type="checkbox"
                                            checked={form.status}
                                            onChange={(e) => update("status", e.target.checked)}
                                            disabled={saving}
                                        />
                                        Enabled (status)
                                    </label>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className={styles.modalFoot}>
                        <button
                            type="button"
                            className={`${styles.btn} ${styles.btnGhost}`}
                            onClick={onClose}
                            disabled={saving}
                        >
                            Cancel
                        </button>
                        <button type="submit" className={`${styles.btn} ${styles.btnAccent}`} disabled={saving}>
                            {saving ? "Saving…" : isEdit ? "Save changes" : "Create menu"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

// Collects the id of `excludeId` plus every one of its descendants, so the
// parent dropdown can't offer a choice that would create a cycle.
function getDescendantIds(excludeId, menus) {
    if (excludeId == null) return new Set();

    const childrenOf = new Map();
    menus.forEach((m) => {
        if (m.parent_id != null) {
            if (!childrenOf.has(m.parent_id)) childrenOf.set(m.parent_id, []);
            childrenOf.get(m.parent_id).push(m.id);
        }
    });

    const excluded = new Set([excludeId]);
    const stack = [excludeId];
    while (stack.length) {
        const current = stack.pop();
        (childrenOf.get(current) || []).forEach((childId) => {
            if (!excluded.has(childId)) {
                excluded.add(childId);
                stack.push(childId);
            }
        });
    }
    return excluded;
}
