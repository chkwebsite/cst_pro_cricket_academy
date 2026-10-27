"use client";

import { ArrowLeft, Image as ImageIcon, Play, Save, Upload, Video } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useUser } from "../components/UserContext";

const EMPTY_FORM = {
    album_id: "",
    video_title: "",
    video_type: "YouTube",
    video_url: "",
    duration: "",
    sort_order: 0,
    status: 1,
};

export default function GalleryVideoForm({ id = null, defaultAlbumId = "" }) {
    const router = useRouter();
    const isEdit = Boolean(id);
    const { user } = useUser();

    const [formData, setFormData] = useState({
        ...EMPTY_FORM,
        album_id: defaultAlbumId,
    });
    const [videoFile, setVideoFile] = useState(null);
    const [thumbnailFile, setThumbnailFile] = useState(null);
    const [thumbnailPreview, setThumbnailPreview] = useState("");
    const [albums, setAlbums] = useState([]);

    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(false);
    const [error, setError] = useState("");
    const [successMsg, setSuccessMsg] = useState("");

    // Load albums
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

    // Load single video for edit
    useEffect(() => {
        if (!id) return;
        const fetchVideo = async () => {
            try {
                setFetching(true);
                setError("");
                const res = await fetch(`/api/gallery-videos/${id}`);
                const json = await res.json();
                if (!res.ok || !json.success) {
                    throw new Error(json.message || "Failed to fetch gallery video");
                }
                const v = json.data;
                setFormData({
                    album_id: v.album_id ? String(v.album_id) : "",
                    video_title: v.video_title || "",
                    video_type: v.video_type || "YouTube",
                    video_url: v.video_url || "",
                    duration: v.duration || "",
                    sort_order: v.sort_order ?? 0,
                    status: v.status ?? 1,
                });
                if (v.thumbnail_image) {
                    setThumbnailPreview(v.thumbnail_image);
                }
            } catch (err) {
                setError(err.message);
            } finally {
                setFetching(false);
            }
        };
        fetchVideo();
    }, [id]);

    const handleThumbnailChange = (e) => {
        const file = e.target.files?.[0];
        if (file) {
            setThumbnailFile(file);
            setThumbnailPreview(URL.createObjectURL(file));
        }
    };

    const handleVideoFileChange = (e) => {
        const file = e.target.files?.[0];
        if (file) {
            setVideoFile(file);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");
        setSuccessMsg("");

        if (!formData.video_title.trim()) {
            setError("Video title is required.");
            return;
        }

        if (formData.video_type === "Upload" && !isEdit && !videoFile) {
            setError("Please choose a video file to upload.");
            return;
        }

        if (formData.video_type !== "Upload" && !formData.video_url.trim()) {
            setError(`Please enter a valid ${formData.video_type} URL.`);
            return;
        }

        try {
            setLoading(true);
            const fd = new FormData();
            if (formData.album_id) fd.append("album_id", formData.album_id);
            fd.append("video_title", formData.video_title.trim());
            fd.append("video_type", formData.video_type);
            if (formData.video_url) fd.append("video_url", formData.video_url.trim());
            if (formData.duration) fd.append("duration", formData.duration.trim());
            fd.append("sort_order", String(formData.sort_order ?? 0));
            fd.append("status", String(formData.status ?? 1));
            if (user?.id) fd.append("uploaded_by", String(user.id));

            if (formData.video_type === "Upload" && videoFile) {
                fd.append("video", videoFile);
            }
            if (thumbnailFile) {
                fd.append("thumbnail_image", thumbnailFile);
            }

            const url = isEdit ? `/api/gallery-videos/${id}` : "/api/gallery-videos";
            const method = isEdit ? "PUT" : "POST";

            const res = await fetch(url, {
                method,
                body: fd,
            });
            const json = await res.json();
            if (!res.ok || !json.success) {
                throw new Error(json.message || "Failed to save video.");
            }

            setSuccessMsg(isEdit ? "Video updated successfully!" : "Video added successfully!");
            setTimeout(() => {
                router.push(
                    `/next_panel/gallery-videos${
                        formData.album_id ? `?album_id=${formData.album_id}` : ""
                    }`
                );
            }, 800);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    if (fetching) {
        return (
            <div className="container-fluid py-5 text-center text-muted">
                <div className="spinner-border text-primary me-2" role="status" />
                Loading video details...
            </div>
        );
    }

    return (
        <div className="container-fluid">
            <div className="row g-4 justify-content-center">
                <div className="col-12 col-xl-10">
                    <div className="bg-white rounded-4 shadow-sm p-4 mb-4">
                        <div className="d-flex justify-content-between align-items-center">
                            <div>
                                <h2 className="h4 mb-1">
                                    {isEdit ? "Edit Gallery Video" : "Add Gallery Video"}
                                </h2>
                                <p className="text-muted mb-0 small">
                                    {isEdit
                                        ? "Update video title, source, album or thumbnail."
                                        : "Embed YouTube / Vimeo video or upload a video file."}
                                </p>
                            </div>
                            <Link
                                href={`/next_panel/gallery-videos${
                                    formData.album_id ? `?album_id=${formData.album_id}` : ""
                                }`}
                                className="btn btn-outline-secondary btn-sm"
                            >
                                <ArrowLeft size={16} className="me-1" /> Back to Videos
                            </Link>
                        </div>
                    </div>

                    {error && (
                        <div className="alert alert-danger alert-dismissible fade show" role="alert">
                            {error}
                        </div>
                    )}

                    {successMsg && (
                        <div className="alert alert-success alert-dismissible fade show" role="alert">
                            {successMsg}
                        </div>
                    )}

                    <form onSubmit={handleSubmit}>
                        <div className="card border-0 shadow-sm rounded-4 p-4 mb-4">
                            <h5 className="mb-3 text-secondary">Video Information</h5>
                            <div className="row g-3">
                                <div className="col-md-6">
                                    <label className="form-label fw-semibold">
                                        Video Title <span className="text-danger">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        className="form-control"
                                        placeholder="e.g. Match Highlights: ST Academy vs Warriors"
                                        value={formData.video_title}
                                        onChange={(e) =>
                                            setFormData({ ...formData, video_title: e.target.value })
                                        }
                                        required
                                    />
                                </div>

                                <div className="col-md-6">
                                    <label className="form-label fw-semibold">Album (Optional)</label>
                                    <select
                                        className="form-select"
                                        value={formData.album_id}
                                        onChange={(e) =>
                                            setFormData({ ...formData, album_id: e.target.value })
                                        }
                                    >
                                        <option value="">No specific album (General Video)</option>
                                        {albums.map((al) => (
                                            <option key={al.id} value={al.id}>
                                                {al.album_title}{" "}
                                                {al.category_name ? `(${al.category_name})` : ""}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className="col-md-4">
                                    <label className="form-label fw-semibold">
                                        Video Source <span className="text-danger">*</span>
                                    </label>
                                    <select
                                        className="form-select"
                                        value={formData.video_type}
                                        onChange={(e) =>
                                            setFormData({ ...formData, video_type: e.target.value })
                                        }
                                    >
                                        <option value="YouTube">YouTube</option>
                                        <option value="Vimeo">Vimeo</option>
                                        <option value="Upload">Direct File Upload</option>
                                    </select>
                                </div>

                                <div className="col-md-4">
                                    <label className="form-label fw-semibold">Duration (Optional)</label>
                                    <input
                                        type="text"
                                        className="form-control"
                                        placeholder="e.g. 05:24 or 12 mins"
                                        value={formData.duration}
                                        onChange={(e) =>
                                            setFormData({ ...formData, duration: e.target.value })
                                        }
                                    />
                                </div>

                                <div className="col-md-2">
                                    <label className="form-label fw-semibold">Sort Order</label>
                                    <input
                                        type="number"
                                        className="form-control"
                                        value={formData.sort_order}
                                        onChange={(e) =>
                                            setFormData({
                                                ...formData,
                                                sort_order: parseInt(e.target.value, 10) || 0,
                                            })
                                        }
                                    />
                                </div>

                                <div className="col-md-2">
                                    <label className="form-label fw-semibold">Status</label>
                                    <select
                                        className="form-select"
                                        value={formData.status}
                                        onChange={(e) =>
                                            setFormData({
                                                ...formData,
                                                status: parseInt(e.target.value, 10),
                                            })
                                        }
                                    >
                                        <option value={1}>Active</option>
                                        <option value={0}>Inactive</option>
                                    </select>
                                </div>

                                {formData.video_type !== "Upload" ? (
                                    <div className="col-12">
                                        <label className="form-label fw-semibold">
                                            {formData.video_type} Video URL <span className="text-danger">*</span>
                                        </label>
                                        <input
                                            type="url"
                                            className="form-control"
                                            placeholder={
                                                formData.video_type === "YouTube"
                                                    ? "https://www.youtube.com/watch?v=dQw4w9WgXcQ or https://youtu.be/..."
                                                    : "https://vimeo.com/123456789"
                                            }
                                            value={formData.video_url}
                                            onChange={(e) =>
                                                setFormData({ ...formData, video_url: e.target.value })
                                            }
                                            required
                                        />
                                        <small className="text-muted">
                                            Paste full video link from {formData.video_type}.
                                        </small>
                                    </div>
                                ) : (
                                    <div className="col-12">
                                        <label className="form-label fw-semibold">
                                            {isEdit ? "Replace Video File (Optional)" : "Upload Video File (Max 100MB)"}
                                        </label>
                                        <input
                                            type="file"
                                            className="form-control"
                                            accept="video/mp4,video/webm,video/quicktime"
                                            onChange={handleVideoFileChange}
                                        />
                                        <small className="text-muted d-block mt-1">
                                            Supported video formats: MP4, WEBM, MOV (Max 100MB).
                                        </small>
                                        {isEdit && formData.video_url && (
                                            <div className="mt-2 text-muted small">
                                                Current file: <code>{formData.video_url}</code>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="card border-0 shadow-sm rounded-4 p-4 mb-4">
                            <h5 className="mb-3 text-secondary">Custom Thumbnail Image</h5>
                            <div className="row g-3 align-items-center">
                                <div className="col-md-4">
                                    {thumbnailPreview ? (
                                        <div className="position-relative border rounded-3 p-2 text-center bg-dark">
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img
                                                src={thumbnailPreview}
                                                alt="Thumbnail preview"
                                                className="img-fluid rounded"
                                                style={{ maxHeight: "180px", objectFit: "cover" }}
                                            />
                                        </div>
                                    ) : (
                                        <div
                                            className="border border-dashed rounded-3 p-4 text-center text-muted bg-light d-flex flex-column align-items-center justify-content-center"
                                            style={{ minHeight: "150px" }}
                                        >
                                            <ImageIcon size={36} className="mb-2 text-secondary opacity-50" />
                                            <small>No custom thumbnail uploaded</small>
                                        </div>
                                    )}
                                </div>

                                <div className="col-md-8">
                                    <label className="form-label fw-semibold">
                                        Upload Thumbnail (Max 5MB)
                                    </label>
                                    <input
                                        type="file"
                                        className="form-control"
                                        accept="image/jpeg,image/png,image/webp,image/jpg"
                                        onChange={handleThumbnailChange}
                                    />
                                    <small className="text-muted d-block mt-1">
                                        For YouTube / Vimeo, a custom thumbnail can override the default video cover.
                                    </small>
                                </div>
                            </div>
                        </div>

                        <div className="d-flex justify-content-end gap-2 mb-5">
                            <Link
                                href={`/next_panel/gallery-videos${
                                    formData.album_id ? `?album_id=${formData.album_id}` : ""
                                }`}
                                className="btn btn-outline-secondary px-4"
                            >
                                Cancel
                            </Link>
                            <button
                                type="submit"
                                className="btn btn-primary px-4 d-flex align-items-center gap-2"
                                disabled={loading}
                            >
                                <Save size={18} />
                                {loading ? "Saving..." : isEdit ? "Update Video" : "Save Video"}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
