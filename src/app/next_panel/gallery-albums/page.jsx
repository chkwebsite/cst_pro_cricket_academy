"use client";

import {
    Calendar,
    Edit,
    Film,
    Image as ImageIcon,
    Images,
    MapPin,
    Plus,
    Search,
    SearchSlash,
    Star,
    Trash2,
    Video,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import GalleryNavigationTabs from "../components/GalleryNavigationTabs";
import Pagination from "../components/Pagination";

export default function GalleryAlbumsPage() {
    const [albums, setAlbums] = useState([]);
    const [page, setPage] = useState(1);
    const PAGE_SIZE = 10;
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [deletingId, setDeletingId] = useState(null);
    const [error, setError] = useState(null);

    // Filters
    const [search, setSearch] = useState("");
    const [categoryId, setCategoryId] = useState("");
    const [status, setStatus] = useState("");
    const [isFeatured, setIsFeatured] = useState("");

    // Load Categories for dropdown
    useEffect(() => {
        const loadCategories = async () => {
            try {
                const res = await fetch("/api/gallery-categories?status=1");
                const json = await res.json();
                if (res.ok && json.success) {
                    setCategories(json.data || []);
                }
            } catch {
                // Ignore
            }
        };
        loadCategories();
    }, []);

    const loadAlbums = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams();
            if (search.trim()) params.set("search", search.trim());
            if (categoryId) params.set("category_id", categoryId);
            if (status !== "") params.set("status", status);
            if (isFeatured !== "") params.set("is_featured", isFeatured);

            const query = params.toString();
            const res = await fetch(`/api/gallery-albums${query ? `?${query}` : ""}`);
            const json = await res.json();
            if (!res.ok || !json.success) {
                throw new Error(json.message || "Unable to load gallery albums.");
            }
            setAlbums(json.data || []);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [search, categoryId, status, isFeatured]);

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        loadAlbums();
    }, [categoryId, status, isFeatured, loadAlbums]);

    useEffect(() => {
        setPage(1);
    }, [search, categoryId, status, isFeatured]);

    const totalPages = Math.ceil(albums.length / PAGE_SIZE) || 1;
    const pagedAlbums = albums.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

    const handleSearch = (e) => {
        e.preventDefault();
        loadAlbums();
    };

    const handleClear = () => {
        setSearch("");
        setCategoryId("");
        setStatus("");
        setIsFeatured("");
        setTimeout(() => loadAlbums(), 0);
    };

    const handleDelete = async (album) => {
        if (!confirm(`Are you sure you want to delete album "${album.album_title}"?`)) return;

        setDeletingId(album.id);
        setError(null);
        try {
            const res = await fetch(`/api/gallery-albums/${album.id}`, { method: "DELETE" });
            const json = await res.json();
            if (!res.ok || !json.success) {
                throw new Error(json.message || "Unable to delete album.");
            }
            setAlbums((prev) => prev.filter((item) => item.id !== album.id));
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
                                    <Film size={24} className="text-primary" />
                                    <h1 className="h4 mb-0">Gallery Albums</h1>
                                </div>
                                <p className="text-muted mb-0 small">
                                    Create and manage photo & video albums by event, match, or date.
                                </p>
                            </div>

                            <Link
                                href="/next_panel/gallery-albums/new"
                                className="btn btn-primary fw-semibold d-flex align-items-center gap-2"
                            >
                                <Plus size={18} /> New Album
                            </Link>
                        </div>
                    </div>
                </div>

                {/* Navigation Tabs */}
                <div className="col-12">
                    <GalleryNavigationTabs albumCount={albums.length} />
                </div>

                {/* Filters & Search */}
                <div className="col-12">
                    <div className="bg-white rounded-4 shadow-sm p-3 mb-4">
                        <div className="row g-3 align-items-center">
                            <div className="col-12 col-md-4">
                                <form onSubmit={handleSearch}>
                                    <div className="input-group">
                                        <span className="input-group-text bg-white">
                                            <Search size={16} className="text-muted" />
                                        </span>
                                        <input
                                            type="text"
                                            className="form-control"
                                            placeholder="Search by title, location..."
                                            value={search}
                                            onChange={(e) => setSearch(e.target.value)}
                                        />
                                        <button type="submit" className="btn btn-outline-primary">
                                            Search
                                        </button>
                                    </div>
                                </form>
                            </div>

                            <div className="col-6 col-md-3">
                                <select
                                    className="form-select"
                                    value={categoryId}
                                    onChange={(e) => setCategoryId(e.target.value)}
                                >
                                    <option value="">All Categories</option>
                                    {categories.map((c) => (
                                        <option key={c.id} value={c.id}>
                                            {c.category_name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="col-6 col-md-2">
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

                            <div className="col-6 col-md-2">
                                <select
                                    className="form-select"
                                    value={isFeatured}
                                    onChange={(e) => setIsFeatured(e.target.value)}
                                >
                                    <option value="">All Albums</option>
                                    <option value="1">Featured Only</option>
                                    <option value="0">Not Featured</option>
                                </select>
                            </div>

                            <div className="col-6 col-md-1 d-flex">
                                <button
                                    type="button"
                                    className="btn btn-outline-secondary w-100"
                                    onClick={handleClear}
                                    title="Reset filters"
                                >
                                    <SearchSlash size={16} />
                                </button>
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
                                        <th style={{ width: "50px" }}>#</th>
                                        <th style={{ width: "90px" }}>Cover</th>
                                        <th>Album Title</th>
                                        <th>Category</th>
                                        <th>Branch / Academy</th>
                                        <th>Event Date</th>
                                        <th style={{ width: "80px" }}>Featured</th>
                                        <th style={{ width: "90px" }}>Status</th>
                                        <th style={{ width: "220px" }} className="text-end">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {loading ? (
                                        <tr>
                                            <td colSpan={9} className="text-center py-5 text-muted">
                                                <div className="spinner-border spinner-border-sm text-primary me-2" />
                                                Loading albums...
                                            </td>
                                        </tr>
                                    ) : albums.length === 0 ? (
                                        <tr>
                                            <td colSpan={9} className="text-center py-5 text-muted">
                                                No gallery albums found.
                                            </td>
                                        </tr>
                                    ) : (
                                        pagedAlbums.map((album, idx) => (
                                            <tr key={album.id}>
                                                <td className="text-muted small">{(page - 1) * PAGE_SIZE + idx + 1}</td>
                                                <td>
                                                    {album.cover_image ? (
                                                        /* eslint-disable-next-line @next/next/no-img-element */
                                                        <img
                                                            src={album.cover_image}
                                                            alt={album.album_title}
                                                            className="rounded"
                                                            style={{
                                                                width: "60px",
                                                                height: "44px",
                                                                objectFit: "cover",
                                                            }}
                                                        />
                                                    ) : (
                                                        <div
                                                            className="rounded bg-light d-flex align-items-center justify-content-center text-muted"
                                                            style={{ width: "60px", height: "44px" }}
                                                        >
                                                            <ImageIcon size={18} />
                                                        </div>
                                                    )}
                                                </td>
                                                <td>
                                                    <div className="fw-semibold text-dark">
                                                        {album.album_title}
                                                    </div>
                                                    <div className="d-flex align-items-center gap-2 small text-muted">
                                                        <code>{album.slug}</code>
                                                        {album.location && (
                                                            <span>
                                                                <MapPin size={12} className="me-1" />
                                                                {album.location}
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td>
                                                    <span className="badge bg-primary-subtle text-primary border border-primary-subtle px-2 py-1">
                                                        {album.category_name || "Uncategorized"}
                                                    </span>
                                                </td>
                                                <td>
                                                    <span className="small text-muted">
                                                        {album.branch_name || album.academy_name || "All"}
                                                    </span>
                                                </td>
                                                <td>
                                                    {album.event_date ? (
                                                        <span className="small text-muted d-flex align-items-center gap-1">
                                                            <Calendar size={13} />
                                                            {new Date(album.event_date).toLocaleDateString()}
                                                        </span>
                                                    ) : (
                                                        <span className="text-muted small">-</span>
                                                    )}
                                                </td>
                                                <td>
                                                    {Number(album.is_featured) === 1 ? (
                                                        <span className="badge bg-warning text-dark px-2 py-1 d-inline-flex align-items-center gap-1">
                                                            <Star size={11} fill="currentColor" /> Featured
                                                        </span>
                                                    ) : (
                                                        <span className="text-muted small">-</span>
                                                    )}
                                                </td>
                                                <td>
                                                    {Number(album.status) === 1 ? (
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
                                                            href={`/next_panel/gallery-images?album_id=${album.id}`}
                                                            className="btn btn-sm btn-outline-primary"
                                                            title="Manage photos in this album"
                                                        >
                                                            <Images size={14} className="me-1" /> Photos
                                                        </Link>
                                                        <Link
                                                            href={`/next_panel/gallery-videos?album_id=${album.id}`}
                                                            className="btn btn-sm btn-outline-danger"
                                                            title="Manage videos in this album"
                                                        >
                                                            <Video size={14} className="me-1" /> Videos
                                                        </Link>
                                                        <Link
                                                            href={`/next_panel/gallery-albums/${album.id}/edit`}
                                                            className="btn btn-sm btn-outline-secondary"
                                                            title="Edit album"
                                                        >
                                                            <Edit size={15} />
                                                        </Link>
                                                        <button
                                                            type="button"
                                                            className="btn btn-sm btn-outline-danger"
                                                            onClick={() => handleDelete(album)}
                                                            disabled={deletingId === album.id}
                                                            title="Delete album"
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
                            total={albums.length}
                            onPageChange={setPage}
                            pageSize={PAGE_SIZE}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
