"use client";

import {
    Clock,
    Edit,
    ExternalLink,
    Play,
    Plus,
    Search,
    SearchSlash,
    Trash2,
    Video,
    X,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import GalleryNavigationTabs from "../components/GalleryNavigationTabs";

function getEmbedUrl(type, url) {
    if (!url) return null;
    if (type === "YouTube") {
        let videoId = "";
        try {
            const parsed = new URL(url);
            if (parsed.hostname.includes("youtu.be")) {
                videoId = parsed.pathname.replace(/^\//, "");
            } else if (parsed.searchParams.has("v")) {
                videoId = parsed.searchParams.get("v");
            } else if (parsed.pathname.includes("/embed/")) {
                videoId = parsed.pathname.split("/embed/")[1];
            }
        } catch {
            return null;
        }
        return videoId ? `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1` : null;
    }
    if (type === "Vimeo") {
        const match = url.match(/vimeo\.com\/(?:video\/)?([0-9]+)/);
        return match ? `https://player.vimeo.com/video/${match[1]}?autoplay=1` : null;
    }
    return null;
}

export default function GalleryVideosPage() {
    const [videos, setVideos] = useState([]);
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
    const [videoType, setVideoType] = useState("");
    const [status, setStatus] = useState("");
    const [search, setSearch] = useState("");

    // Video Player Modal
    const [playingVideo, setPlayingVideo] = useState(null);

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

    const loadVideos = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams();
            if (albumId) params.set("album_id", albumId);
            if (videoType) params.set("video_type", videoType);
            if (status !== "") params.set("status", status);
            if (search.trim()) params.set("search", search.trim());

            const query = params.toString();
            const res = await fetch(`/api/gallery-videos${query ? `?${query}` : ""}`);
            const json = await res.json();
            if (!res.ok || !json.success) {
                throw new Error(json.message || "Unable to load gallery videos.");
            }
            setVideos(json.data || []);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [albumId, videoType, status, search]);

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        loadVideos();
    }, [albumId, videoType, status, loadVideos]);

    const handleSearch = (e) => {
        e.preventDefault();
        loadVideos();
    };

    const handleClear = () => {
        setSearch("");
        setAlbumId("");
        setVideoType("");
        setStatus("");
        setTimeout(() => loadVideos(), 0);
    };

    const handleDelete = async (video) => {
        if (!confirm(`Are you sure you want to delete video "${video.video_title}"?`)) return;

        setDeletingId(video.id);
        setError(null);
        try {
            const res = await fetch(`/api/gallery-videos/${video.id}`, { method: "DELETE" });
            const json = await res.json();
            if (!res.ok || !json.success) {
                throw new Error(json.message || "Unable to delete video.");
            }
            setVideos((prev) => prev.filter((item) => item.id !== video.id));
        } catch (err) {
            setError(err.message);
        } finally {
            setDeletingId(null);
        }
    };

    const addHref = albumId
        ? `/next_panel/gallery-videos/new?album_id=${albumId}`
        : "/next_panel/gallery-videos/new";

    return (
        <div className="container-fluid">
            <div className="row g-4">
                {/* Header */}
                <div className="col-12">
                    <div className="bg-white rounded-4 shadow-sm p-4 mb-2">
                        <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-3">
                            <div>
                                <div className="d-flex align-items-center gap-2 mb-1">
                                    <Video size={24} className="text-primary" />
                                    <h1 className="h4 mb-0">Gallery Videos</h1>
                                </div>
                                <p className="text-muted mb-0 small">
                                    Manage match recordings, highlights, training drills, and tutorials.
                                </p>
                            </div>

                            <Link
                                href={addHref}
                                className="btn btn-primary fw-semibold d-flex align-items-center gap-2"
                            >
                                <Plus size={18} /> Add Video
                            </Link>
                        </div>
                    </div>
                </div>

                {/* Navigation Tabs */}
                <div className="col-12">
                    <GalleryNavigationTabs videoCount={videos.length} />
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
                                            placeholder="Search by title, url..."
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
                                    value={videoType}
                                    onChange={(e) => setVideoType(e.target.value)}
                                >
                                    <option value="">All Sources</option>
                                    <option value="YouTube">YouTube</option>
                                    <option value="Vimeo">Vimeo</option>
                                    <option value="Upload">Uploaded Files</option>
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

                {/* Content Cards */}
                <div className="col-12">
                    {error && (
                        <div className="alert alert-danger alert-dismissible fade show mb-4" role="alert">
                            {error}
                        </div>
                    )}

                    {loading ? (
                        <div className="text-center py-5 text-muted">
                            <div className="spinner-border spinner-border-sm text-primary me-2" />
                            Loading gallery videos...
                        </div>
                    ) : videos.length === 0 ? (
                        <div className="card border-0 shadow-sm rounded-4 p-5 text-center text-muted">
                            <Video size={48} className="mx-auto mb-3 text-secondary opacity-50" />
                            <h5 className="mb-2">No videos found</h5>
                            <p className="mb-3 small">Add YouTube links, Vimeo videos, or upload video files.</p>
                            <Link href={addHref} className="btn btn-primary btn-sm mx-auto">
                                <Plus size={16} className="me-1" /> Add Video Now
                            </Link>
                        </div>
                    ) : (
                        <div className="row g-3">
                            {videos.map((vid) => {
                                const typeBadgeClass =
                                    vid.video_type === "YouTube"
                                        ? "bg-danger text-white"
                                        : vid.video_type === "Vimeo"
                                        ? "bg-info text-white"
                                        : "bg-primary text-white";

                                return (
                                    <div key={vid.id} className="col-12 col-sm-6 col-lg-4 col-xl-3">
                                        <div className="card h-100 border-0 shadow-sm rounded-4 overflow-hidden position-relative">
                                            {/* Video Cover */}
                                            <div
                                                className="position-relative bg-dark d-flex align-items-center justify-content-center"
                                                style={{ height: "190px", cursor: "pointer" }}
                                                onClick={() => setPlayingVideo(vid)}
                                            >
                                                {vid.thumbnail_image ? (
                                                    /* eslint-disable-next-line @next/next/no-img-element */
                                                    <img
                                                        src={vid.thumbnail_image}
                                                        alt={vid.video_title}
                                                        className="w-100 h-100"
                                                        style={{ objectFit: "cover" }}
                                                        loading="lazy"
                                                    />
                                                ) : (
                                                    <div className="text-secondary opacity-50 d-flex flex-column align-items-center">
                                                        <Video size={44} />
                                                    </div>
                                                )}

                                                {/* Play Button Overlay */}
                                                <div
                                                    className="position-absolute d-flex align-items-center justify-content-center rounded-circle bg-danger text-white shadow"
                                                    style={{ width: "52px", height: "52px" }}
                                                >
                                                    <Play size={24} fill="currentColor" className="ms-1" />
                                                </div>

                                                <span
                                                    className={`badge position-absolute top-0 start-0 m-2 ${typeBadgeClass}`}
                                                >
                                                    {vid.video_type}
                                                </span>

                                                {vid.duration && (
                                                    <span className="badge bg-dark bg-opacity-75 text-white position-absolute bottom-0 end-0 m-2 small d-inline-flex align-items-center gap-1">
                                                        <Clock size={11} /> {vid.duration}
                                                    </span>
                                                )}
                                            </div>

                                            <div className="card-body p-3">
                                                <h6
                                                    className="card-title fw-semibold text-truncate mb-1"
                                                    title={vid.video_title}
                                                >
                                                    {vid.video_title}
                                                </h6>
                                                <div className="d-flex align-items-center gap-2 small text-muted">
                                                    <span className="badge bg-light text-secondary border">
                                                        {vid.album_title || "General"}
                                                    </span>
                                                    {Number(vid.status) === 1 ? (
                                                        <span className="text-success small">• Active</span>
                                                    ) : (
                                                        <span className="text-secondary small">• Inactive</span>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="card-footer bg-white border-top-0 d-flex justify-content-between align-items-center pt-0 pb-3 px-3">
                                                <button
                                                    type="button"
                                                    className="btn btn-sm btn-outline-danger d-flex align-items-center gap-1"
                                                    onClick={() => setPlayingVideo(vid)}
                                                >
                                                    <Play size={13} fill="currentColor" /> Play
                                                </button>

                                                <div className="d-flex gap-1">
                                                    {vid.video_url && vid.video_type !== "Upload" && (
                                                        <a
                                                            href={vid.video_url}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="btn btn-sm btn-outline-secondary"
                                                            title="Open source URL"
                                                        >
                                                            <ExternalLink size={14} />
                                                        </a>
                                                    )}
                                                    <Link
                                                        href={`/next_panel/gallery-videos/${vid.id}/edit`}
                                                        className="btn btn-sm btn-outline-secondary"
                                                        title="Edit video"
                                                    >
                                                        <Edit size={14} />
                                                    </Link>
                                                    <button
                                                        type="button"
                                                        className="btn btn-sm btn-outline-danger"
                                                        onClick={() => handleDelete(vid)}
                                                        disabled={deletingId === vid.id}
                                                        title="Delete video"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* Video Player Modal */}
            {playingVideo && (
                <div
                    className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center"
                    style={{
                        zIndex: 1060,
                        backgroundColor: "rgba(0, 0, 0, 0.85)",
                        backdropFilter: "blur(4px)",
                    }}
                    onClick={() => setPlayingVideo(null)}
                >
                    <div
                        className="bg-black rounded-4 overflow-hidden position-relative shadow-lg"
                        style={{ width: "90%", maxWidth: "860px" }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="d-flex justify-content-between align-items-center p-3 text-white bg-dark">
                            <h6 className="mb-0 text-truncate me-3">{playingVideo.video_title}</h6>
                            <button
                                type="button"
                                className="btn btn-sm btn-outline-light rounded-circle"
                                onClick={() => setPlayingVideo(null)}
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <div className="ratio ratio-16x9">
                            {playingVideo.video_type === "Upload" ? (
                                <video
                                    src={playingVideo.video_url}
                                    controls
                                    autoPlay
                                    poster={playingVideo.thumbnail_image}
                                    className="w-100 h-100"
                                />
                            ) : getEmbedUrl(playingVideo.video_type, playingVideo.video_url) ? (
                                <iframe
                                    src={getEmbedUrl(playingVideo.video_type, playingVideo.video_url)}
                                    title={playingVideo.video_title}
                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                    allowFullScreen
                                    className="w-100 h-100 border-0"
                                />
                            ) : (
                                <div className="d-flex flex-column align-items-center justify-content-center text-white p-4">
                                    <p className="mb-2">Unable to embed this video directly.</p>
                                    <a
                                        href={playingVideo.video_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="btn btn-danger btn-sm"
                                    >
                                        Watch on {playingVideo.video_type} <ExternalLink size={14} className="ms-1" />
                                    </a>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
