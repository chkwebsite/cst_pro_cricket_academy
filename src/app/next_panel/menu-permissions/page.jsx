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

export default function MenuPermissionsPage() {
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const [search, setSearch] = useState("");

    const [page, setPage] = useState(1);

    const [pagination, setPagination] = useState({
        total: 0,
        totalPages: 1,
    });

    // =====================================================
    // LOAD MENU PERMISSIONS
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

            const res = await fetch(
                `/api/menu-permissions?${p.toString()}`
            );

            const json = await readJson(res);

            if (!res.ok) {
                throw new Error(
                    json.message ||
                    "Unable to load menu permissions."
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
    // INITIAL LOAD
    // =====================================================

    useEffect(() => {
        load(1);
    }, []);

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
        if (!confirm("Remove this permission from the menu?")) {
            return;
        }

        try {
            const res = await fetch(
                `/api/menu-permissions/${id}`,
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
                                Menu Permissions
                            </h1>

                            <p className="text-muted mb-0">
                                Control which permissions are
                                required to access each menu.
                            </p>
                        </div>

                        <Link
                            href="/next_panel/menu-permissions/new"
                            className="btn btn-primary fw-semibold"
                        >
                            <Plus
                                size={16}
                                className="me-2"
                            />

                            New Menu Permission
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
                                        placeholder="Search menu or permission..."
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
                                Loading menu permissions...
                            </div>
                        ) : rows.length === 0 ? (
                            <div className="text-center py-5 text-muted">
                                No menu permissions found.
                            </div>
                        ) : (
                            <div className="table-responsive">

                                <table className="table align-middle mb-0">

                                    <thead className="table-light">
                                        <tr>
                                            <th>ID</th>
                                            <th>Menu</th>
                                            <th>Menu Key</th>
                                            <th>Permission</th>
                                            <th>Assigned</th>
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
                                                    <div className="fw-semibold">
                                                        {r.menu_title ||
                                                            r.menu_name ||
                                                            `Menu #${r.menu_id}`}
                                                    </div>
                                                </td>

                                                <td>
                                                    <code>
                                                        {r.menu_key}
                                                    </code>
                                                </td>

                                                <td>
                                                    <span className="badge bg-info-subtle text-info-emphasis">
                                                        {r.permission_name ??
                                                            `Permission #${r.permission_id}`}
                                                    </span>
                                                </td>

                                                <td>
                                                    {r.created_at
                                                        ? new Date(
                                                            r.created_at
                                                        ).toLocaleDateString()
                                                        : "—"}
                                                </td>

                                                <td className="text-end">
                                                    <div className="btn-group btn-group-sm">

                                                        <Link
                                                            href={`/next_panel/menu-permissions/${r.id}`}
                                                            className="btn btn-outline-primary"
                                                        >
                                                            <ArrowUpRight
                                                                size={16}
                                                            />
                                                        </Link>

                                                        <Link
                                                            href={`/next_panel/menu-permissions/${r.id}/edit`}
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
