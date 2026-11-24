"use client";

import { ArrowLeft, Image as ImageIcon, Play, Save, Upload, Video } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useUser } from "../components/UserContext";
import { FormError, RequiredLabel } from "@/app/components/form";

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
    const [fieldErrors, setFieldErrors] = useState({});
    const [successMsg, setSuccessMsg] = useState("");

    const clearError = (field) => {
        if (fieldErrors[field]) {
            setFieldErrors((prev) => {
                const next = { ...prev };
                delete next[field];
                return next;
            });
        }
    };

    const validateField = (name, value) => {
        let err = "";
        const val = typeof value === "string" ? value.trim() : value;
        switch (name) {
            case "video_title":
                if (!val) err = "Video title is required.";
                else if (val.length < 2) err = "Video title must be at least 2 characters.";
                break;
            case "video_url":
                if (formData.video_type !== "Upload") {
                    if (!val) {
                        err = `Please enter a valid ${formData.video_type} URL.`;
                    } else {
                        try {
                            const parsed = new URL(val);
                            const host = parsed.hostname.toLowerCase();
                            if (formData.video_type === "YouTube" && !["youtube.com", "www.youtube.com", "youtu.be", "m.youtube.com", "youtube-nocookie.com", "www.youtube-nocookie.com"].includes(host)) {
                                err = "Please provide a valid YouTube URL.";
                            } else if (formData.video_type === "Vimeo" && !(host === "vimeo.com" || host.endsWith(".vimeo.com"))) {
                                err = "Please provide a valid Vimeo URL.";
                            }
                        } catch {
                            err = "Please enter a valid URL.";
                        }
                    }
                }
                break;
            default:
                break;
        }
        return err;
    };

    const handleBlur = (field) => {
        const err = validateField(field, formData[field]);
        if (err) {
            setFieldErrors((prev) => ({ ...prev, [field]: err }));
        }
    };

    const validateAll = () => {
        const errors = {};
        const titleErr = validateField("video_title", formData.video_title);
        if (titleErr) errors.video_title = titleErr;

        if (formData.video_type !== "Upload") {
            const urlErr = validateField("video_url", formData.video_url);
            if (urlErr) errors.video_url = urlErr;
        } else if (!isEdit && !videoFile) {
            errors.video = "Please choose a video file to upload.";
        }

        setFieldErrors(errors);

        if (Object.keys(errors).length > 0) {
            const firstKey = Object.keys(errors)[0];
            const el = document.querySelector(`[name="${firstKey}"]`);
            if (el) {
                el.scrollIntoView({ behavior: "smooth", block: "center" });
                el.focus();
            }
            return false;
        }
        return true;
    };

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
            if (file.size > 2 * 1024 * 1024) {
                const msg = `Thumbnail "${file.name}" is ${(file.size / (1024 * 1024)).toFixed(2)}MB. Maximum allowed image size is 2MB.`;
                setFieldErrors((prev) => ({ ...prev, thumbnail_image: msg }));
                setError(msg);
                e.target.value = "";
                setThumbnailFile(null);
                setThumbnailPreview(null);
                return;
            }
            clearError("thumbnail_image");
            setError("");
            setThumbnailFile(file);
            setThumbnailPreview(URL.createObjectURL(file));
        }
    };

    const handleVideoFileChange = (e) => {
        const file = e.target.files?.[0];
        if (file) {
            if (file.size > 20 * 1024 * 1024) {
                const msg = `Video "${file.name}" is ${(file.size / (1024 * 1024)).toFixed(2)}MB. Maximum allowed video size is 20MB.`;
                setFieldErrors((prev) => ({ ...prev, video: msg }));
                setError(msg);
                e.target.value = "";
                setVideoFile(null);
                return;
            }
            clearError("video");
            setError("");
            setVideoFile(file);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");
        setSuccessMsg("");

        if (!validateAll()) {
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
                if (json.errors) {
                    setFieldErrors(json.errors);
                    const firstKey = Object.keys(json.errors)[0];
                    const el = document.querySelector(`[name="${firstKey}"]`);
                    if (el) {
                        el.scrollIntoView({ behavior: "smooth", block: "center" });
                        el.focus();
                    }
                }
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
                                        Video Title <RequiredLabel />
                                    </label>
                                    <input
                                        type="text"
                                        name="video_title"
                                        className={`form-control ${fieldErrors.video_title ? "is-invalid border-danger" : ""}`}
                                        placeholder="e.g. Match Highlights: ST Academy vs Warriors"
                                        value={formData.video_title}
                                        onChange={(e) => {
                                            clearError("video_title");
                                            setFormData({ ...formData, video_title: e.target.value });
                                        }}
                                        onBlur={() => handleBlur("video_title")}
                                    />
                                    <FormError error={fieldErrors.video_title} />
                                </div>

                                <div className="col-md-6">
                                    <label className="form-label fw-semibold">Album</label>
                                    <select
                                        name="album_id"
                                        className={`form-select ${fieldErrors.album_id ? "is-invalid border-danger" : ""}`}
                                        value={formData.album_id}
                                        onChange={(e) => {
                                            clearError("album_id");
                                            setFormData({ ...formData, album_id: e.target.value });
                                        }}
                                    >
                                        <option value="">No specific album (General Video)</option>
                                        {albums.map((al) => (
                                            <option key={al.id} value={al.id}>
                                                {al.album_title}{" "}
                                                {al.category_name ? `(${al.category_name})` : ""}
                                            </option>
                                        ))}
                                    </select>
                                    <FormError error={fieldErrors.album_id} />
                                </div>

                                <div className="col-md-4">
                                    <label className="form-label fw-semibold">
                                        Video Source <RequiredLabel />
                                    </label>
                                    <select
                                        name="video_type"
                                        className={`form-select ${fieldErrors.video_type ? "is-invalid border-danger" : ""}`}
                                        value={formData.video_type}
                                        onChange={(e) => {
                                            clearError("video_type");
                                            clearError("video_url");
                                            clearError("video");
                                            setFormData({ ...formData, video_type: e.target.value });
                                        }}
                                    >
                                        <option value="YouTube">YouTube</option>
                                        <option value="Vimeo">Vimeo</option>
                                        <option value="Upload">Direct File Upload</option>
                                    </select>
                                    <FormError error={fieldErrors.video_type} />
                                </div>

                                <div className="col-md-4">
                                    <label className="form-label fw-semibold">Duration</label>
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
                                            {formData.video_type} Video URL <RequiredLabel />
                                        </label>
                                        <input
                                            type="url"
                                            name="video_url"
                                            className={`form-control ${fieldErrors.video_url ? "is-invalid border-danger" : ""}`}
                                            placeholder={
                                                formData.video_type === "YouTube"
                                                    ? "https://www.youtube.com/watch?v=dQw4w9WgXcQ or https://youtu.be/..."
                                                    : "https://vimeo.com/123456789"
                                            }
                                            value={formData.video_url}
                                            onChange={(e) => {
                                                clearError("video_url");
                                                setFormData({ ...formData, video_url: e.target.value });
                                            }}
                                            onBlur={() => handleBlur("video_url")}
                                        />
                                        <FormError error={fieldErrors.video_url} />
                                        <small className="text-muted d-block mt-1">
                                            Paste full video link from {formData.video_type}.
                                        </small>
                                    </div>
                                ) : (
                                    <div className="col-12">
                                        <label className="form-label fw-semibold">
                                            {isEdit ? "Replace Video File" : <>Upload Video File (Max 20MB) <RequiredLabel /></>}
                                        </label>
                                        <input
                                            type="file"
                                            name="video"
                                            className={`form-control ${fieldErrors.video ? "is-invalid border-danger" : ""}`}
                                            accept="video/mp4,video/webm,video/quicktime"
                                            onChange={handleVideoFileChange}
                                        />
                                        <FormError error={fieldErrors.video} />
                                        <small className="text-muted d-block mt-1">
                                            Supported video formats: MP4, WEBM, MOV (Max 20MB).
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
                                        Upload Thumbnail (Max 2MB)
                                    </label>
                                    <input
                                        type="file"
                                        name="thumbnail_image"
                                        className={`form-control ${fieldErrors.thumbnail_image ? "is-invalid border-danger" : ""}`}
                                        accept="image/jpeg,image/png,image/webp,image/jpg"
                                        onChange={handleThumbnailChange}
                                    />
                                    <FormError error={fieldErrors.thumbnail_image} />
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
