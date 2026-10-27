"use client";

import { ArrowLeft, Image as ImageIcon, Plus, Save, Upload } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useUser } from "../components/UserContext";

const EMPTY_FORM = {
    album_id: "",
    image_caption: "",
    alt_text: "",
    sort_order: 0,
    status: 1,
};

export default function GalleryImageForm({ id = null, defaultAlbumId = "" }) {
    const router = useRouter();
    const isEdit = Boolean(id);
    const { user } = useUser();

    const [formData, setFormData] = useState({
        ...EMPTY_FORM,
        album_id: defaultAlbumId,
    });
    const [imageFile, setImageFile] = useState(null);
    const [imagePreview, setImagePreview] = useState("");
    const [multipleFiles, setMultipleFiles] = useState([]);
    const [uploadMode, setUploadMode] = useState("single"); // "single" or "bulk" (bulk only on create)

    const [albums, setAlbums] = useState([]);
    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(false);
    const [uploadProgress, setUploadProgress] = useState("");
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

    // Load single image for edit
    useEffect(() => {
        if (!id) return;
        const fetchImage = async () => {
            try {
                setFetching(true);
                setError("");
                const res = await fetch(`/api/gallery-images/${id}`);
                const json = await res.json();
                if (!res.ok || !json.success) {
                    throw new Error(json.message || "Failed to fetch gallery image");
                }
                const img = json.data;
                setFormData({
                    album_id: img.album_id ? String(img.album_id) : "",
                    image_caption: img.image_caption || "",
                    alt_text: img.alt_text || "",
                    sort_order: img.sort_order ?? 0,
                    status: img.status ?? 1,
                });
                if (img.image_path) {
                    setImagePreview(img.image_path);
                }
            } catch (err) {
                setError(err.message);
            } finally {
                setFetching(false);
            }
        };
        fetchImage();
    }, [id]);

    const handleSingleFileChange = (e) => {
        const file = e.target.files?.[0];
        if (file) {
            setImageFile(file);
            setImagePreview(URL.createObjectURL(file));
        }
    };

    const handleMultipleFilesChange = (e) => {
        const files = Array.from(e.target.files || []);
        setMultipleFiles(files);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");
        setSuccessMsg("");

        if (!formData.album_id) {
            setError("Please select an album.");
            return;
        }

        if (!isEdit && uploadMode === "single" && !imageFile) {
            setError("Please select an image file to upload.");
            return;
        }

        if (!isEdit && uploadMode === "bulk" && multipleFiles.length === 0) {
            setError("Please select at least one image file.");
            return;
        }

        try {
            setLoading(true);

            if (isEdit) {
                // Update single image
                const fd = new FormData();
                fd.append("album_id", formData.album_id);
                if (formData.image_caption) fd.append("image_caption", formData.image_caption.trim());
                if (formData.alt_text) fd.append("alt_text", formData.alt_text.trim());
                fd.append("sort_order", String(formData.sort_order ?? 0));
                fd.append("status", String(formData.status ?? 1));
                if (imageFile) fd.append("image", imageFile);

                const res = await fetch(`/api/gallery-images/${id}`, {
                    method: "PUT",
                    body: fd,
                });
                const json = await res.json();
                if (!res.ok || !json.success) {
                    throw new Error(json.message || "Failed to update image.");
                }

                setSuccessMsg("Image updated successfully!");
                setTimeout(() => {
                    router.push(`/next_panel/gallery-images?album_id=${formData.album_id}`);
                }, 800);
            } else if (uploadMode === "bulk") {
                // Bulk upload images sequentially
                let successCount = 0;
                for (let i = 0; i < multipleFiles.length; i++) {
                    const file = multipleFiles[i];
                    setUploadProgress(`Uploading photo ${i + 1} of ${multipleFiles.length}...`);

                    const fd = new FormData();
                    fd.append("album_id", formData.album_id);
                    fd.append("image", file);
                    fd.append(
                        "image_caption",
                        formData.image_caption
                            ? `${formData.image_caption} (${i + 1})`
                            : file.name.replace(/\.[^/.]+$/, "")
                    );
                    fd.append("alt_text", formData.alt_text || file.name);
                    fd.append("sort_order", String(Number(formData.sort_order || 0) + i));
                    fd.append("status", String(formData.status ?? 1));
                    if (user?.id) fd.append("uploaded_by", String(user.id));

                    const res = await fetch("/api/gallery-images", {
                        method: "POST",
                        body: fd,
                    });
                    if (res.ok) successCount++;
                }

                setSuccessMsg(`Successfully uploaded ${successCount} images!`);
                setTimeout(() => {
                    router.push(`/next_panel/gallery-images?album_id=${formData.album_id}`);
                }, 1000);
            } else {
                // Single create
                const fd = new FormData();
                fd.append("album_id", formData.album_id);
                fd.append("image", imageFile);
                if (formData.image_caption) fd.append("image_caption", formData.image_caption.trim());
                if (formData.alt_text) fd.append("alt_text", formData.alt_text.trim());
                fd.append("sort_order", String(formData.sort_order ?? 0));
                fd.append("status", String(formData.status ?? 1));
                if (user?.id) fd.append("uploaded_by", String(user.id));

                const res = await fetch("/api/gallery-images", {
                    method: "POST",
                    body: fd,
                });
                const json = await res.json();
                if (!res.ok || !json.success) {
                    throw new Error(json.message || "Failed to upload image.");
                }

                setSuccessMsg("Image uploaded successfully!");
                setTimeout(() => {
                    router.push(`/next_panel/gallery-images?album_id=${formData.album_id}`);
                }, 800);
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
            setUploadProgress("");
        }
    };

    if (fetching) {
        return (
            <div className="container-fluid py-5 text-center text-muted">
                <div className="spinner-border text-primary me-2" role="status" />
                Loading image details...
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
                                    {isEdit ? "Edit Gallery Image" : "Upload Gallery Photos"}
                                </h2>
                                <p className="text-muted mb-0 small">
                                    {isEdit
                                        ? "Update image caption, album, sorting and preview."
                                        : "Upload single or multiple images to an album."}
                                </p>
                            </div>
                            <Link
                                href={`/next_panel/gallery-images${
                                    formData.album_id ? `?album_id=${formData.album_id}` : ""
                                }`}
                                className="btn btn-outline-secondary btn-sm"
                            >
                                <ArrowLeft size={16} className="me-1" /> Back to Images
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

                    {uploadProgress && (
                        <div className="alert alert-info d-flex align-items-center gap-2" role="alert">
                            <div className="spinner-border spinner-border-sm" />
                            <span>{uploadProgress}</span>
                        </div>
                    )}

                    <form onSubmit={handleSubmit}>
                        {!isEdit && (
                            <div className="card border-0 shadow-sm rounded-4 p-3 mb-4 bg-light">
                                <div className="d-flex align-items-center gap-3">
                                    <span className="fw-semibold">Upload Mode:</span>
                                    <div className="form-check form-check-inline mb-0">
                                        <input
                                            className="form-check-input"
                                            type="radio"
                                            name="uploadMode"
                                            id="modeSingle"
                                            value="single"
                                            checked={uploadMode === "single"}
                                            onChange={() => setUploadMode("single")}
                                        />
                                        <label className="form-check-label" htmlFor="modeSingle">
                                            Single Image
                                        </label>
                                    </div>
                                    <div className="form-check form-check-inline mb-0">
                                        <input
                                            className="form-check-input"
                                            type="radio"
                                            name="uploadMode"
                                            id="modeBulk"
                                            value="bulk"
                                            checked={uploadMode === "bulk"}
                                            onChange={() => setUploadMode("bulk")}
                                        />
                                        <label className="form-check-label" htmlFor="modeBulk">
                                            Bulk Upload (Multiple Photos)
                                        </label>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="card border-0 shadow-sm rounded-4 p-4 mb-4">
                            <h5 className="mb-3 text-secondary">Target Album & Metadata</h5>
                            <div className="row g-3">
                                <div className="col-md-6">
                                    <label className="form-label fw-semibold">
                                        Select Album <span className="text-danger">*</span>
                                    </label>
                                    <select
                                        className="form-select"
                                        value={formData.album_id}
                                        onChange={(e) =>
                                            setFormData({ ...formData, album_id: e.target.value })
                                        }
                                        required
                                    >
                                        <option value="">-- Choose an Album --</option>
                                        {albums.map((al) => (
                                            <option key={al.id} value={al.id}>
                                                {al.album_title}{" "}
                                                {al.category_name ? `(${al.category_name})` : ""}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className="col-md-3">
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

                                <div className="col-md-3">
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

                                <div className="col-md-6">
                                    <label className="form-label fw-semibold">
                                        Caption {uploadMode === "bulk" && "(Optional base caption)"}
                                    </label>
                                    <input
                                        type="text"
                                        className="form-control"
                                        placeholder="e.g. Captain lifting the cup"
                                        value={formData.image_caption}
                                        onChange={(e) =>
                                            setFormData({ ...formData, image_caption: e.target.value })
                                        }
                                    />
                                </div>

                                <div className="col-md-6">
                                    <label className="form-label fw-semibold">Alt Text</label>
                                    <input
                                        type="text"
                                        className="form-control"
                                        placeholder="e.g. Young cricketer hitting cover drive"
                                        value={formData.alt_text}
                                        onChange={(e) =>
                                            setFormData({ ...formData, alt_text: e.target.value })
                                        }
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="card border-0 shadow-sm rounded-4 p-4 mb-4">
                            <h5 className="mb-3 text-secondary">
                                {uploadMode === "bulk" ? "Select Multiple Files" : "Image File"}
                            </h5>

                            {uploadMode === "bulk" ? (
                                <div>
                                    <div className="border border-dashed rounded-3 p-4 text-center bg-light">
                                        <Upload size={36} className="text-secondary opacity-50 mb-2" />
                                        <p className="mb-2 fw-semibold">Choose one or more image files</p>
                                        <input
                                            type="file"
                                            className="form-control"
                                            multiple
                                            accept="image/jpeg,image/png,image/webp,image/jpg"
                                            onChange={handleMultipleFilesChange}
                                        />
                                        <small className="text-muted d-block mt-2">
                                            Supported formats: JPG, PNG, WEBP (Max 5MB each).
                                        </small>
                                    </div>
                                    {multipleFiles.length > 0 && (
                                        <div className="mt-3">
                                            <span className="badge bg-primary fs-6 px-3 py-2">
                                                {multipleFiles.length} file(s) selected for upload
                                            </span>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="row g-3 align-items-center">
                                    <div className="col-md-4">
                                        {imagePreview ? (
                                            <div className="position-relative border rounded-3 p-2 text-center bg-light">
                                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                                <img
                                                    src={imagePreview}
                                                    alt="Preview"
                                                    className="img-fluid rounded"
                                                    style={{ maxHeight: "190px", objectFit: "cover" }}
                                                />
                                            </div>
                                        ) : (
                                            <div
                                                className="border border-dashed rounded-3 p-4 text-center text-muted bg-light d-flex flex-column align-items-center justify-content-center"
                                                style={{ minHeight: "150px" }}
                                            >
                                                <ImageIcon size={36} className="mb-2 text-secondary opacity-50" />
                                                <small>No image selected</small>
                                            </div>
                                        )}
                                    </div>

                                    <div className="col-md-8">
                                        <label className="form-label fw-semibold">
                                            {isEdit ? "Replace Image (Optional)" : "Select Image (Max 5MB)"}
                                        </label>
                                        <input
                                            type="file"
                                            className="form-control"
                                            accept="image/jpeg,image/png,image/webp,image/jpg"
                                            onChange={handleSingleFileChange}
                                        />
                                        <small className="text-muted d-block mt-1">
                                            Allowed formats: JPG, PNG, WEBP.
                                        </small>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="d-flex justify-content-end gap-2 mb-5">
                            <Link
                                href={`/next_panel/gallery-images${
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
                                {loading
                                    ? "Processing..."
                                    : isEdit
                                    ? "Update Image"
                                    : uploadMode === "bulk"
                                    ? `Upload ${multipleFiles.length || ""} Photos`
                                    : "Upload Image"}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
