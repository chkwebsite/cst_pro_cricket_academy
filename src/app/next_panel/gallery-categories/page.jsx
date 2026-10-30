"use client";

import { Edit, FolderTree, Image as ImageIcon, Plus, Search, SearchSlash, Trash2 } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import GalleryNavigationTabs from "../components/GalleryNavigationTabs";
import { useUser } from "../components/UserContext";
import Pagination from "../components/Pagination";

export default function GalleryCategoriesPage() {
    const { user } = useUser();

    const userRole = String(
        user?.user_type || user?.role || user?.role_name || user?.user_role || ""
    )
        .trim()
        .toLowerCase()
        .replace(/[_-]+/g, " ");

    const isSuperAdmin =
        ["super admin", "superadmin", "admin"].includes(userRole) && !user?.academy_id;
    const userAcademyId =
        user?.academy_id && Number(user?.academy_id) !== 0 ? String(user.academy_id) : "";
    const isAcademyAdmin = Boolean(userAcademyId) && !isSuperAdmin;

    const [categories, setCategories] = useState([]);
    const [page, setPage] = useState(1);
    const PAGE_SIZE = 10;
    const [academies, setAcademies] = useState([]);
    const [selectedAcademyId, setSelectedAcademyId] = useState("");
    const [loading, setLoading] = useState(true);
    const [deletingId, setDeletingId] = useState(null);
    const [error, setError] = useState(null);
    const [search, setSearch] = useState("");
    const [status, setStatus] = useState("");

    // Load academies for filter if Super Admin
    useEffect(() => {
        if (!isSuperAdmin) return;
        const loadAcademies = async () => {
            try {
                const res = await fetch("/api/academies");
                const json = await res.json();
                if (res.ok && json.success) {
                    setAcademies(Array.isArray(json.data) ? json.data : []);
                }
            } catch {
                // Ignore
            }
        };
        loadAcademies();
    }, [isSuperAdmin]);

    const loadCategories = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams();
            if (search.trim()) params.set("search", search.trim());
            if (status !== "") params.set("status", status);

            // Scope by academy
            if (isAcademyAdmin && userAcademyId) {
                params.set("academy_id", userAcademyId);
            } else if (selectedAcademyId) {
                params.set("academy_id", selectedAcademyId);
            }

            const query = params.toString();
            const res = await fetch(`/api/gallery-categories${query ? `?${query}` : ""}`);
            const json = await res.json();
            if (!res.ok || !json.success) {
                throw new Error(json.message || "Unable to load gallery categories.");
            }
            setCategories(json.data || []);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [search, status, isAcademyAdmin, userAcademyId, selectedAcademyId]);

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        loadCategories();
    }, [status, selectedAcademyId, userAcademyId, loadCategories]);

    useEffect(() => {
        setPage(1);
    }, [search, status, selectedAcademyId]);

    const totalPages = Math.ceil(categories.length / PAGE_SIZE) || 1;
    const pagedCategories = categories.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

    const handleSearch = (e) => {
        e.preventDefault();
        loadCategories();
    };

    const handleClear = () => {
        setSearch("");
        setStatus("");
        setSelectedAcademyId("");
        setTimeout(() => loadCategories(), 0);
    };

    const handleDelete = async (cat) => {
        if (!confirm(`Are you sure you want to delete category "${cat.category_name}"?`)) return;

        setDeletingId(cat.id);
        setError(null);
        try {
            const res = await fetch(`/api/gallery-categories/${cat.id}`, { method: "DELETE" });
            const json = await res.json();
            if (!res.ok || !json.success) {
                throw new Error(json.message || "Unable to delete category.");
            }
            setCategories((prev) => prev.filter((item) => item.id !== cat.id));
        } catch (err) {
            setError(err.message);
        } finally {
            setDeletingId(null);
        }
    };

    return (
        <div className="container-fluid">
            <div className="row g-4">
                {/* Header */}
                <div className="col-12">
                    <div className="bg-white rounded-4 shadow-sm p-4 mb-2">
                        <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-3">
                            <div>
                                <div className="d-flex align-items-center gap-2 mb-1">
                                    <FolderTree size={24} className="text-primary" />
                                    <h1 className="h4 mb-0">Gallery Categories</h1>
                                </div>
                                <p className="text-muted mb-0 small">
                                    Manage photo and video categories, tags, and album groupings.
                                </p>
                            </div>

                            <Link
                                href="/next_panel/gallery-categories/new"
                                className="btn btn-primary fw-semibold d-flex align-items-center gap-2"
                            >
                                <Plus size={18} /> New Category
                            </Link>
                        </div>
                    </div>
                </div>

                {/* Navigation Tabs */}
                <div className="col-12">
                    <GalleryNavigationTabs categoryCount={categories.length} />
                </div>

                {/* Filters & Search */}
                <div className="col-12">
                    <div className="bg-white rounded-4 shadow-sm p-3 mb-4">
                        <div className="row g-3 align-items-center">
                            <div className="col-12 col-md-6 col-lg-5">
                                <form onSubmit={handleSearch}>
                                    <div className="input-group">
                                        <span className="input-group-text bg-white">
                                            <Search size={16} className="text-muted" />
                                        </span>
                                        <input
                                            type="text"
                                            className="form-control"
                                            placeholder="Search by name, slug, description..."
                                            value={search}
                                            onChange={(e) => setSearch(e.target.value)}
                                        />
                                        <button type="submit" className="btn btn-outline-primary">
                                            Search
                                        </button>
                                    </div>
                                </form>
                            </div>

                            {isSuperAdmin && (
                                <div className="col-6 col-md-3 col-lg-3">
                                    <select
                                        className="form-select"
                                        value={selectedAcademyId}
                                        onChange={(e) => setSelectedAcademyId(e.target.value)}
                                    >
                                        <option value="">All Academies</option>
                                        {academies.map((ac) => (
                                            <option key={ac.id} value={ac.id}>
                                                {ac.academy_name || ac.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            <div className="col-6 col-md-3 col-lg-2">
                                <select
                                    className="form-select"
                                    value={status}
                                    onChange={(e) => setStatus(e.target.value)}
                                >
                                    <option value="">All Statuses</option>
                                    <option value="1">Active</option>
                                    <option value="0">Inactive</option>
                                </select>
                            </div>

                            <div className="col-6 col-md-3 col-lg-2 d-flex gap-2">
                                <button
                                    type="button"
                                    className="btn btn-outline-secondary d-flex align-items-center gap-1"
                                    onClick={handleClear}
                                    title="Reset filters"
                                >
                                    <SearchSlash size={16} /> Reset
                                </button>
                                {!loading && (
                                    <span className="align-self-center text-muted small ms-auto">
                                        {categories.length} item(s)
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Content Table */}
                <div className="col-12">
                    {error && (
                        <div className="alert alert-danger alert-dismissible fade show mb-4" role="alert">
                            {error}
                        </div>
                    )}

                    <div className="card border-0 shadow-sm rounded-4 overflow-hidden">
                        <div className="table-responsive">
                            <table className="table table-hover align-middle mb-0">
                                <thead className="table-light">
                                    <tr>
                                        <th style={{ width: "60px" }}>#</th>
                                        <th style={{ width: "100px" }}>Image</th>
                                        <th>Category Name</th>
                                        <th>Slug</th>
                                        <th>Academy</th>
                                        <th style={{ width: "90px" }}>Sort</th>
                                        <th style={{ width: "100px" }}>Status</th>
                                        <th style={{ width: "150px" }} className="text-end">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {loading ? (
                                        <tr>
                                            <td colSpan={8} className="text-center py-5 text-muted">
                                                <div className="spinner-border spinner-border-sm text-primary me-2" />
                                                Loading categories...
                                            </td>
                                        </tr>
                                    ) : categories.length === 0 ? (
                                        <tr>
                                            <td colSpan={8} className="text-center py-5 text-muted">
                                                No gallery categories found.
                                            </td>
                                        </tr>
                                    ) : (
                                        pagedCategories.map((cat, idx) => (
                                            <tr key={cat.id}>
                                                <td className="text-muted small">{(page - 1) * PAGE_SIZE + idx + 1}</td>
                                                <td>
                                                    {cat.featured_image ? (
                                                        /* eslint-disable-next-line @next/next/no-img-element */
                                                        <img
                                                            src={cat.featured_image}
                                                            alt={cat.category_name}
                                                            className="rounded"
                                                            style={{
                                                                width: "56px",
                                                                height: "42px",
                                                                objectFit: "cover",
                                                            }}
                                                        />
                                                    ) : (
                                                        <div
                                                            className="rounded bg-light d-flex align-items-center justify-content-center text-muted"
                                                            style={{ width: "56px", height: "42px" }}
                                                        >
                                                            <ImageIcon size={18} />
                                                        </div>
                                                    )}
                                                </td>
                                                <td>
                                                    <div className="fw-semibold text-dark">
                                                        {cat.category_name}
                                                    </div>
                                                    {cat.description && (
                                                        <small className="text-muted d-block text-truncate" style={{ maxWidth: "260px" }}>
                                                            {cat.description}
                                                        </small>
                                                    )}
                                                </td>
                                                <td>
                                                    <code className="text-primary small">{cat.slug}</code>
                                                </td>
                                                <td>
                                                    <span className="small text-muted">
                                                        {cat.academy_name || "All"}
                                                    </span>
                                                </td>
                                                <td>{cat.sort_order ?? 0}</td>
                                                <td>
                                                    {Number(cat.status) === 1 ? (
                                                        <span className="badge bg-success-subtle text-success border border-success-subtle px-2 py-1">
                                                            Active
                                                        </span>
                                                    ) : (
                                                        <span className="badge bg-secondary-subtle text-secondary border px-2 py-1">
                                                            Inactive
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="text-end">
                                                    <div className="d-flex justify-content-end gap-1">
                                                        <Link
                                                            href={`/next_panel/gallery-albums?category_id=${cat.id}`}
                                                            className="btn btn-sm btn-outline-info"
                                                            title="View albums in this category"
                                                        >
                                                            Albums
                                                        </Link>
                                                        <Link
                                                            href={`/next_panel/gallery-categories/${cat.id}/edit`}
                                                            className="btn btn-sm btn-outline-secondary"
                                                            title="Edit category"
                                                        >
                                                            <Edit size={15} />
                                                        </Link>
                                                        <button
                                                            type="button"
                                                            className="btn btn-sm btn-outline-danger"
                                                            onClick={() => handleDelete(cat)}
                                                            disabled={deletingId === cat.id}
                                                            title="Delete category"
                                                        >
                                                            <Trash2 size={15} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                        <Pagination
                            page={page}
                            totalPages={totalPages}
                            total={categories.length}
                            onPageChange={setPage}
                            pageSize={PAGE_SIZE}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
