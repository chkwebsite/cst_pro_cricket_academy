"use client";

import {
    Edit,
    Eye,
    Grid,
    Image as ImageIcon,
    Images,
    List,
    Plus,
    Search,
    SearchSlash,
    Trash2,
    X,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import GalleryNavigationTabs from "../components/GalleryNavigationTabs";

export default function GalleryImagesPage() {
    const [images, setImages] = useState([]);
    const [albums, setAlbums] = useState([]);
    const [loading, setLoading] = useState(true);
    const [deletingId, setDeletingId] = useState(null);
    const [error, setError] = useState(null);

    // Filters
    const [albumId, setAlbumId] = useState(() => {
        if (typeof window !== "undefined") {
            const params = new URLSearchParams(window.location.search);
            return params.get("album_id") || "";
        }
        return "";
    });
    const [status, setStatus] = useState("");
    const [search, setSearch] = useState("");
    const [viewMode, setViewMode] = useState("grid"); // "grid" | "table"

    // Lightbox state for panel
    const [lightboxImage, setLightboxImage] = useState(null);

    // Load albums for dropdown
    useEffect(() => {
        const loadAlbums = async () => {
            try {
                const res = await fetch("/api/gallery-albums?status=1");
                const json = await res.json();
                if (res.ok && json.success) {
                    setAlbums(json.data || []);
                }
            } catch {
                // Ignore
            }
        };
        loadAlbums();
    }, []);

    const loadImages = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams();
            if (albumId) params.set("album_id", albumId);
            if (status !== "") params.set("status", status);
            if (search.trim()) params.set("search", search.trim());

            const query = params.toString();
            const res = await fetch(`/api/gallery-images${query ? `?${query}` : ""}`);
            const json = await res.json();
            if (!res.ok || !json.success) {
                throw new Error(json.message || "Unable to load gallery images.");
            }
            setImages(json.data || []);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [albumId, status, search]);

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        loadImages();
    }, [albumId, status, loadImages]);

    const handleSearch = (e) => {
        e.preventDefault();
        loadImages();
    };

    const handleClear = () => {
        setSearch("");
        setAlbumId("");
        setStatus("");
        setTimeout(() => loadImages(), 0);
    };

    const handleDelete = async (img) => {
        if (!confirm("Are you sure you want to delete this photo?")) return;

        setDeletingId(img.id);
        setError(null);
        try {
            const res = await fetch(`/api/gallery-images/${img.id}`, { method: "DELETE" });
            const json = await res.json();
            if (!res.ok || !json.success) {
                throw new Error(json.message || "Unable to delete image.");
            }
            setImages((prev) => prev.filter((item) => item.id !== img.id));
        } catch (err) {
            setError(err.message);
        } finally {
            setDeletingId(null);
        }
    };

    const addHref = albumId
        ? `/next_panel/gallery-images/new?album_id=${albumId}`
        : "/next_panel/gallery-images/new";

    return (
        <div className="container-fluid">
            <div className="row g-4">
                {/* Header */}
                <div className="col-12">
                    <div className="bg-white rounded-4 shadow-sm p-4 mb-2">
                        <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-3">
                            <div>
                                <div className="d-flex align-items-center gap-2 mb-1">
                                    <Images size={24} className="text-primary" />
                                    <h1 className="h4 mb-0">Gallery Images</h1>
                                </div>
                                <p className="text-muted mb-0 small">
                                    Upload, organize and manage photo galleries for matches and events.
                                </p>
                            </div>

                            <Link
                                href={addHref}
                                className="btn btn-primary fw-semibold d-flex align-items-center gap-2"
                            >
                                <Plus size={18} /> Upload Photos
                            </Link>
                        </div>
                    </div>
                </div>

                {/* Navigation Tabs */}
                <div className="col-12">
                    <GalleryNavigationTabs imageCount={images.length} />
                </div>

                {/* Filters */}
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
                                            placeholder="Search by caption, alt text..."
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
                                    value={albumId}
                                    onChange={(e) => setAlbumId(e.target.value)}
                                >
                                    <option value="">All Albums</option>
                                    {albums.map((al) => (
                                        <option key={al.id} value={al.id}>
                                            {al.album_title}
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

                            <div className="col-6 col-md-2 d-flex gap-2">
                                <button
                                    type="button"
                                    className="btn btn-outline-secondary"
                                    onClick={handleClear}
                                    title="Reset filters"
                                >
                                    <SearchSlash size={16} />
                                </button>

                                <div className="btn-group" role="group">
                                    <button
                                        type="button"
                                        className={`btn btn-sm ${
                                            viewMode === "grid"
                                                ? "btn-primary"
                                                : "btn-outline-secondary"
                                        }`}
                                        onClick={() => setViewMode("grid")}
                                        title="Grid View"
                                    >
                                        <Grid size={16} />
                                    </button>
                                    <button
                                        type="button"
                                        className={`btn btn-sm ${
                                            viewMode === "table"
                                                ? "btn-primary"
                                                : "btn-outline-secondary"
                                        }`}
                                        onClick={() => setViewMode("table")}
                                        title="Table View"
                                    >
                                        <List size={16} />
                                    </button>
                                </div>
                            </div>

                            <div className="col-6 col-md-1 text-end">
                                {!loading && (
                                    <span className="text-muted small">{images.length} photos</span>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Content */}
                <div className="col-12">
                    {error && (
                        <div className="alert alert-danger alert-dismissible fade show mb-4" role="alert">
                            {error}
                        </div>
                    )}

                    {loading ? (
                        <div className="text-center py-5 text-muted">
                            <div className="spinner-border spinner-border-sm text-primary me-2" />
                            Loading gallery photos...
                        </div>
                    ) : images.length === 0 ? (
                        <div className="card border-0 shadow-sm rounded-4 p-5 text-center text-muted">
                            <ImageIcon size={48} className="mx-auto mb-3 text-secondary opacity-50" />
                            <h5 className="mb-2">No photos found</h5>
                            <p className="mb-3 small">
                                {albumId
                                    ? "No photos uploaded to this album yet."
                                    : "Get started by uploading photos to an album."}
                            </p>
                            <Link href={addHref} className="btn btn-primary btn-sm mx-auto">
                                <Plus size={16} className="me-1" /> Upload Photos Now
                            </Link>
                        </div>
                    ) : viewMode === "grid" ? (
                        /* GRID CARDS VIEW */
                        <div className="row g-3">
                            {images.map((img) => (
                                <div key={img.id} className="col-12 col-sm-6 col-md-4 col-xl-3">
                                    <div className="card h-100 border-0 shadow-sm rounded-4 overflow-hidden position-relative">
                                        <div
                                            className="position-relative bg-dark"
                                            style={{ height: "200px", cursor: "pointer" }}
                                            onClick={() => setLightboxImage(img)}
                                        >
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img
                                                src={img.image_path}
                                                alt={img.alt_text || img.image_caption || "Gallery Photo"}
                                                className="w-100 h-100"
                                                style={{ objectFit: "cover" }}
                                                loading="lazy"
                                            />
                                            <div
                                                className="position-absolute top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center bg-dark bg-opacity-25 opacity-0 hover-opacity-100 transition"
                                                style={{ transition: "opacity 0.2s" }}
                                            >
                                                <Eye className="text-white" size={28} />
                                            </div>

                                            <span className="badge bg-dark bg-opacity-75 text-white position-absolute top-0 end-0 m-2 small">
                                                #{img.sort_order ?? 0}
                                            </span>

                                            {Number(img.status) === 0 && (
                                                <span className="badge bg-danger position-absolute top-0 start-0 m-2">
                                                    Inactive
                                                </span>
                                            )}
                                        </div>

                                        <div className="card-body p-3">
                                            <div className="fw-semibold text-truncate small mb-1" title={img.image_caption || "Untitled"}>
                                                {img.image_caption || <span className="text-muted fst-italic">Untitled photo</span>}
                                            </div>
                                            <div className="text-muted small text-truncate">
                                                <span className="badge bg-primary-subtle text-primary border border-primary-subtle">
                                                    {img.album_title || "Album"}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="card-footer bg-white border-top-0 d-flex justify-content-between align-items-center pt-0 pb-3 px-3">
                                            <button
                                                type="button"
                                                className="btn btn-sm btn-outline-primary"
                                                onClick={() => setLightboxImage(img)}
                                                title="Preview Photo"
                                            >
                                                <Eye size={14} className="me-1" /> View
                                            </button>

                                            <div className="d-flex gap-1">
                                                <Link
                                                    href={`/next_panel/gallery-images/${img.id}/edit`}
                                                    className="btn btn-sm btn-outline-secondary"
                                                    title="Edit photo"
                                                >
                                                    <Edit size={14} />
                                                </Link>
                                                <button
                                                    type="button"
                                                    className="btn btn-sm btn-outline-danger"
                                                    onClick={() => handleDelete(img)}
                                                    disabled={deletingId === img.id}
                                                    title="Delete photo"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        /* TABLE VIEW */
                        <div className="card border-0 shadow-sm rounded-4 overflow-hidden">
                            <div className="table-responsive">
                                <table className="table table-hover align-middle mb-0">
                                    <thead className="table-light">
                                        <tr>
                                            <th style={{ width: "50px" }}>#</th>
                                            <th style={{ width: "100px" }}>Photo</th>
                                            <th>Caption / Title</th>
                                            <th>Album</th>
                                            <th>Alt Text</th>
                                            <th style={{ width: "80px" }}>Sort</th>
                                            <th style={{ width: "90px" }}>Status</th>
                                            <th style={{ width: "130px" }} className="text-end">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {images.map((img, idx) => (
                                            <tr key={img.id}>
                                                <td className="text-muted small">{idx + 1}</td>
                                                <td>
                                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                                    <img
                                                        src={img.image_path}
                                                        alt={img.alt_text || "Photo"}
                                                        className="rounded"
                                                        style={{
                                                            width: "60px",
                                                            height: "45px",
                                                            objectFit: "cover",
                                                            cursor: "pointer",
                                                        }}
                                                        onClick={() => setLightboxImage(img)}
                                                    />
                                                </td>
                                                <td>
                                                    <div className="fw-semibold text-dark">
                                                        {img.image_caption || <span className="text-muted fst-italic">Untitled</span>}
                                                    </div>
                                                </td>
                                                <td>
                                                    <span className="badge bg-primary-subtle text-primary border border-primary-subtle">
                                                        {img.album_title || "Album"}
                                                    </span>
                                                </td>
                                                <td>
                                                    <span className="small text-muted text-truncate d-block" style={{ maxWidth: "200px" }}>
                                                        {img.alt_text || "-"}
                                                    </span>
                                                </td>
                                                <td>{img.sort_order ?? 0}</td>
                                                <td>
                                                    {Number(img.status) === 1 ? (
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
                                                        <button
                                                            type="button"
                                                            className="btn btn-sm btn-outline-info"
                                                            onClick={() => setLightboxImage(img)}
                                                            title="Preview full size"
                                                        >
                                                            <Eye size={15} />
                                                        </button>
                                                        <Link
                                                            href={`/next_panel/gallery-images/${img.id}/edit`}
                                                            className="btn btn-sm btn-outline-secondary"
                                                            title="Edit image"
                                                        >
                                                            <Edit size={15} />
                                                        </Link>
                                                        <button
                                                            type="button"
                                                            className="btn btn-sm btn-outline-danger"
                                                            onClick={() => handleDelete(img)}
                                                            disabled={deletingId === img.id}
                                                            title="Delete image"
                                                        >
                                                            <Trash2 size={15} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Quick Lightbox Modal for Panel */}
            {lightboxImage && (
                <div
                    className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center"
                    style={{
                        zIndex: 1060,
                        backgroundColor: "rgba(0, 0, 0, 0.85)",
                        backdropFilter: "blur(4px)",
                    }}
                    onClick={() => setLightboxImage(null)}
                >
                    <div
                        className="position-relative text-center p-3"
                        style={{ maxWidth: "90vw", maxHeight: "90vh" }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <button
                            type="button"
                            className="btn btn-light position-absolute top-0 end-0 m-2 rounded-circle"
                            onClick={() => setLightboxImage(null)}
                            title="Close"
                        >
                            <X size={20} />
                        </button>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                            src={lightboxImage.image_path}
                            alt={lightboxImage.alt_text || "Full Preview"}
                            className="rounded shadow-lg img-fluid"
                            style={{ maxHeight: "80vh", objectFit: "contain" }}
                        />
                        <div className="text-white mt-2">
                            <h6 className="mb-0">{lightboxImage.image_caption || lightboxImage.album_title}</h6>
                            {lightboxImage.alt_text && (
                                <small className="text-light opacity-75">{lightboxImage.alt_text}</small>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
