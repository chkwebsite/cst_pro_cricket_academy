"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
    ArrowUpRight,
    Edit,
    Plus,
    Search,
    Trash2,
} from "lucide-react";

async function readJson(res) {
    const text = await res.text();

    if (!text) {
        return {};
    }

    try {
        return JSON.parse(text);
    } catch {
        return {
            message: text,
        };
    }
}

export default function MenuPage() {
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const [search, setSearch] = useState("");
    const [menuType, setMenuType] = useState("");
    const [status, setStatus] = useState("");
    const [parentFilter, setParentFilter] = useState("");

    const [page, setPage] = useState(1);

    const [pagination, setPagination] = useState({
        total: 0,
        totalPages: 1,
    });

    // =====================================================
    // LOAD MENUS
    // =====================================================

    const load = async (nextPage = page) => {
        setLoading(true);
        setError(null);

        try {
            const p = new URLSearchParams({
                page: String(nextPage),
                limit: "20",
            });

            if (search.trim()) {
                p.set("search", search.trim());
            }

            if (menuType) {
                p.set("menu_type", menuType);
            }

            if (status) {
                p.set("status", status);
            }

            if (parentFilter === "top") {
                p.set("parent_id", "0");
            }

            const res = await fetch(
                `/api/menu?${p.toString()}`
            );

            const json = await readJson(res);

            if (!res.ok) {
                throw new Error(
                    json.message ||
                    "Unable to load menus."
                );
            }

            setRows(json.data || []);

            setPagination(
                json.pagination || {
                    total: 0,
                    totalPages: 1,
                }
            );

            setPage(nextPage);
        } catch (e) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    // =====================================================
    // LOAD WHEN FILTERS CHANGE
    // =====================================================

    useEffect(() => {
        load(1);
    }, [menuType, status, parentFilter]);

    // =====================================================
    // SEARCH
    // =====================================================

    const submit = (e) => {
        e.preventDefault();
        load(1);
    };

    // =====================================================
    // CLEAR SEARCH
    // =====================================================

    const clear = () => {
        setSearch("");

        setTimeout(() => {
            load(1);
        }, 0);
    };

    // =====================================================
    // DELETE
    // =====================================================

    const remove = async (id) => {
        if (!confirm("Delete this menu?")) {
            return;
        }

        try {
            const res = await fetch(
                `/api/menu/${id}`,
                {
                    method: "DELETE",
                }
            );

            const json = await readJson(res);

            if (!res.ok) {
                throw new Error(
                    json.message ||
                    "Unable to delete."
                );
            }

            load(page);
        } catch (e) {
            setError(e.message);
        }
    };

    // =====================================================
    // UI
    // =====================================================

    return (
        <div className="container-fluid">
            <div className="row g-4">

                {/* =================================================
                    HEADER
                ================================================= */}

                <div className="col-12">
                    <div className="bg-white rounded-4 shadow-sm p-4 mb-4 d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3">

                        <div>
                            <h1 className="h4 mb-2">
                                Menus
                            </h1>

                            <p className="text-muted mb-0">
                                Manage sidebar and navigation
                                menu items.
                            </p>
                        </div>

                        <Link
                            href="/next_panel/menu/new"
                            className="btn btn-primary fw-semibold"
                        >
                            <Plus
                                size={16}
                                className="me-2"
                            />

                            New Menu
                        </Link>
                    </div>
                </div>

                {/* =================================================
                    LIST
                ================================================= */}

                <div className="col-12">
                    <div className="bg-white rounded-4 shadow-sm p-3">

                        {/* =================================================
                            FILTERS
                        ================================================= */}

                        <div className="d-flex flex-column flex-md-row gap-2 mb-3">

                            <form
                                className="flex-grow-1"
                                onSubmit={submit}
                            >
                                <div
                                    className="input-group"
                                    style={{
                                        maxWidth: 560,
                                    }}
                                >
                                    <span className="input-group-text bg-white">
                                        <Search size={16} />
                                    </span>

                                    <input
                                        className="form-control"
                                        placeholder="Search key, name, title, url..."
                                        value={search}
                                        onChange={(e) =>
                                            setSearch(
                                                e.target.value
                                            )
                                        }
                                    />

                                    <button
                                        type="submit"
                                        className="btn btn-outline-secondary"
                                    >
                                        Search
                                    </button>

                                    <button
                                        type="button"
                                        className="btn btn-outline-danger"
                                        onClick={clear}
                                    >
                                        Clear
                                    </button>
                                </div>
                            </form>

                            <select
                                className="form-select"
                                style={{
                                    maxWidth: 180,
                                }}
                                value={parentFilter}
                                onChange={(e) =>
                                    setParentFilter(
                                        e.target.value
                                    )
                                }
                            >
                                <option value="">
                                    All Menus
                                </option>

                                <option value="top">
                                    Top Level Only
                                </option>
                            </select>

                            <select
                                className="form-select"
                                style={{
                                    maxWidth: 180,
                                }}
                                value={menuType}
                                onChange={(e) =>
                                    setMenuType(
                                        e.target.value
                                    )
                                }
                            >
                                <option value="">
                                    All Types
                                </option>

                                <option value="module">
                                    Module
                                </option>

                                <option value="link">
                                    Link
                                </option>

                                <option value="heading">
                                    Heading
                                </option>
                            </select>

                            <select
                                className="form-select"
                                style={{
                                    maxWidth: 180,
                                }}
                                value={status}
                                onChange={(e) =>
                                    setStatus(
                                        e.target.value
                                    )
                                }
                            >
                                <option value="">
                                    All Statuses
                                </option>

                                <option value="1">
                                    Active
                                </option>

                                <option value="0">
                                    Inactive
                                </option>
                            </select>
                        </div>

                        {/* =================================================
                            ERROR
                        ================================================= */}

                        {error && (
                            <div className="alert alert-danger">
                                {error}
                            </div>
                        )}

                        {/* =================================================
                            LOADING
                        ================================================= */}

                        {loading ? (
                            <div className="text-center py-5 text-muted">
                                Loading menus...
                            </div>
                        ) : rows.length === 0 ? (
                            <div className="text-center py-5 text-muted">
                                No menus found.
                            </div>
                        ) : (
                            <div className="table-responsive">

                                <table className="table align-middle mb-0">

                                    <thead className="table-light">
                                        <tr>
                                            <th>ID</th>
                                            <th>Order</th>
                                            <th>Menu</th>
                                            <th>Key</th>
                                            <th>Parent</th>
                                            <th>Type</th>
                                            <th>Sidebar</th>
                                            <th>Status</th>
                                            <th className="text-end">
                                                Actions
                                            </th>
                                        </tr>
                                    </thead>

                                    <tbody>
                                        {rows.map((r) => (
                                            <tr key={r.id}>

                                                <td>
                                                    {r.id}
                                                </td>

                                                <td>
                                                    {r.menu_order}
                                                </td>

                                                <td>
                                                    <div className="fw-semibold">
                                                        {r.menu_title}
                                                    </div>

                                                    <small className="text-muted">
                                                        {r.menu_name}
                                                    </small>
                                                </td>

                                                <td>
                                                    <code>
                                                        {r.menu_key}
                                                    </code>
                                                </td>

                                                <td>
                                                    {r.parent_menu_title ||
                                                        r.parent_menu_name || (
                                                            <span className="text-muted">
                                                                —
                                                            </span>
                                                        )}
                                                </td>

                                                <td>
                                                    <span className="badge bg-info-subtle text-info-emphasis text-capitalize">
                                                        {r.menu_type}
                                                    </span>
                                                </td>

                                                <td>
                                                    {r.is_sidebar ? (
                                                        <span className="badge bg-primary-subtle text-primary-emphasis">
                                                            Yes
                                                        </span>
                                                    ) : (
                                                        <span className="text-muted">
                                                            No
                                                        </span>
                                                    )}
                                                </td>

                                                <td>
                                                    <span
                                                        className={`badge ${r.status === 1
                                                            ? "bg-success"
                                                            : "bg-secondary"
                                                            }`}
                                                    >
                                                        {r.status === 1
                                                            ? "Active"
                                                            : "Inactive"}
                                                    </span>
                                                </td>

                                                <td className="text-end">
                                                    <div className="btn-group btn-group-sm">

                                                        <Link
                                                            href={`/next_panel/menu/${r.id}`}
                                                            className="btn btn-outline-primary"
                                                        >
                                                            <ArrowUpRight
                                                                size={16}
                                                            />
                                                        </Link>

                                                        <Link
                                                            href={`/next_panel/menu/${r.id}/edit`}
                                                            className="btn btn-outline-secondary"
                                                        >
                                                            <Edit
                                                                size={16}
                                                            />
                                                        </Link>

                                                        <button
                                                            type="button"
                                                            className="btn btn-outline-danger"
                                                            onClick={() =>
                                                                remove(
                                                                    r.id
                                                                )
                                                            }
                                                        >
                                                            <Trash2
                                                                size={16}
                                                            />
                                                        </button>

                                                    </div>
                                                </td>

                                            </tr>
                                        ))}
                                    </tbody>

                                </table>

                            </div>
                        )}

                        {/* =================================================
                            PAGINATION
                        ================================================= */}

                        {!loading &&
                            pagination.totalPages > 1 && (
                                <div className="d-flex justify-content-between align-items-center mt-3">

                                    <small className="text-muted">
                                        Total: {pagination.total}
                                    </small>

                                    <div className="btn-group">

                                        <button
                                            type="button"
                                            className="btn btn-outline-secondary btn-sm"
                                            disabled={page <= 1}
                                            onClick={() =>
                                                load(page - 1)
                                            }
                                        >
                                            Previous
                                        </button>

                                        <span className="btn btn-outline-secondary btn-sm disabled">
                                            {page} /{" "}
                                            {pagination.totalPages}
                                        </span>

                                        <button
                                            type="button"
                                            className="btn btn-outline-secondary btn-sm"
                                            disabled={
                                                page >=
                                                pagination.totalPages
                                            }
                                            onClick={() =>
                                                load(page + 1)
                                            }
                                        >
                                            Next
                                        </button>

                                    </div>
                                </div>
                            )}

                    </div>
                </div>

            </div>
        </div>
    );
}
