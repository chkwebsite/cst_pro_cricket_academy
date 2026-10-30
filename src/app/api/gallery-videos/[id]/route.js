import { NextResponse } from "next/server";
import pool from "@/app/components/lib/db";
import fs from "fs/promises";
import path from "path";

function jsonError(message, status = 400) {
  return NextResponse.json({ success: false, message }, { status });
}

async function getId(context) {
  const params = await context.params; // Works with current Next.js App Router params.
  const id = Number(params?.id);
  return Number.isInteger(id) && id > 0 ? id : null;
}

// GET /api/gallery-videos/:id
export async function GET(request, context) {
  let connection;
  const id = await getId(context);
  if (!id) return jsonError("Invalid video ID.");

  try {
    connection = await pool.getConnection();
    const [rows] = await connection.execute(
      `SELECT gv.*, ga.album_title, CONCAT_WS(' ', u.first_name, u.last_name) AS uploaded_by_name
       FROM cst_gallery_videos gv
       LEFT JOIN cst_gallery_albums ga ON ga.id = gv.album_id AND ga.is_deleted = 0
       LEFT JOIN cst_users u ON u.id = gv.uploaded_by
       WHERE gv.id = ? AND gv.is_deleted = 0 LIMIT 1`, [id]
    );
    if (!rows.length) return jsonError("Gallery video not found.", 404);
    return NextResponse.json({ success: true, data: rows[0] });
  } catch (error) {
    console.error("GET Single Gallery Video Error:", error);
    return jsonError("Failed to fetch gallery video.", 500);
  } finally {
    if (connection) connection.release();
  }
}

// PUT /api/gallery-videos/:id
export async function PUT(request, context) {
  let connection;
  const id = await getId(context);
  if (!id) return jsonError("Invalid video ID.");

  let savedVideoPath = null;
  let savedThumbnailPath = null;

  try {
    const formData = await request.formData();
    const albumIdRaw = formData.get("album_id");
    const album_id = albumIdRaw === null || albumIdRaw === "" ? null : Number(albumIdRaw);
    const video_title = (formData.get("video_title") || "").toString().trim();
    const video_type = (formData.get("video_type") || "YouTube").toString();
    const submittedVideoUrl = (formData.get("video_url") || "").toString().trim();
    const sort_order = Number(formData.get("sort_order") || 0);
    const status = Number(formData.get("status") ?? 1);
    const duration = (formData.get("duration") || "").toString().trim() || null;
    const videoFile = formData.get("video");
    const thumbnailFile = formData.get("thumbnail_image");

    if (!video_title) return jsonError("video_title is required.");
    if (!["YouTube", "Vimeo", "Upload"].includes(video_type)) {
      return jsonError("video_type must be YouTube, Vimeo or Upload.");
    }
    if (album_id !== null && (!Number.isInteger(album_id) || album_id < 1)) return jsonError("Invalid album_id.");

    connection = await pool.getConnection();
    const [existing] = await connection.execute(
      "SELECT * FROM cst_gallery_videos WHERE id = ? AND is_deleted = 0 LIMIT 1",
      [id]
    );
    if (!existing.length) return jsonError("Gallery video not found.", 404);
    const current = existing[0];

    if (album_id !== null) {
      const [albumRows] = await connection.execute(
        "SELECT id FROM cst_gallery_albums WHERE id = ? AND is_deleted = 0 LIMIT 1",
        [album_id]
      );
      if (!albumRows.length) return jsonError("Invalid album_id or album is deleted.");
    }

    let finalVideoUrl = submittedVideoUrl || current.video_url;

    if (video_type === "Upload") {
      if (videoFile && typeof videoFile.arrayBuffer === "function" && videoFile.size > 0) {
        const VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime"];
        if (!VIDEO_TYPES.includes(videoFile.type)) return jsonError("Only MP4, WEBM and MOV videos are allowed.");
        if (videoFile.size > 20 * 1024 * 1024) return jsonError("Video file must not exceed 20MB.");
        const uploadDir = path.join(process.cwd(), "public", "images", "uploads", "gallery-videos");
        await fs.mkdir(uploadDir, { recursive: true });
        const ext = path.extname(videoFile.name || "").toLowerCase() || ".mp4";
        const fileName = `${Date.now()}-${crypto.randomUUID()}${ext}`;
        await fs.writeFile(path.join(uploadDir, fileName), Buffer.from(await videoFile.arrayBuffer()), { flag: "wx" });
        savedVideoPath = `/images/uploads/gallery-videos/${fileName}`;
        finalVideoUrl = savedVideoPath;
      }
    } else {
      if (!finalVideoUrl) return jsonError("video_url is required for YouTube and Vimeo videos.");
    }

    let finalThumbnailPath = current.thumbnail_image;
    if (thumbnailFile && typeof thumbnailFile.arrayBuffer === "function" && thumbnailFile.size > 0) {
      const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
      if (!IMAGE_TYPES.includes(thumbnailFile.type)) return jsonError("Thumbnail must be JPG, PNG or WEBP.");
      if (thumbnailFile.size > 2 * 1024 * 1024) return jsonError("Thumbnail must not exceed 2MB.");
      const uploadDir = path.join(process.cwd(), "public", "images", "uploads", "gallery-video-thumbnails");
      await fs.mkdir(uploadDir, { recursive: true });
      const ext = path.extname(thumbnailFile.name || "").toLowerCase() || ".jpg";
      const fileName = `${Date.now()}-${crypto.randomUUID()}${ext}`;
      await fs.writeFile(path.join(uploadDir, fileName), Buffer.from(await thumbnailFile.arrayBuffer()), { flag: "wx" });
      savedThumbnailPath = `/images/uploads/gallery-video-thumbnails/${fileName}`;
      finalThumbnailPath = savedThumbnailPath;
    }

    await connection.execute(
      `UPDATE cst_gallery_videos
       SET album_id = ?, video_title = ?, video_url = ?, video_type = ?, thumbnail_image = ?, duration = ?, sort_order = ?, status = ?
       WHERE id = ? AND is_deleted = 0`,
      [album_id, video_title, finalVideoUrl, video_type, finalThumbnailPath, duration, sort_order, status, id]
    );

    // Clean up old files if replaced
    if (savedVideoPath && current.video_type === "Upload" && current.video_url?.startsWith("/images/uploads/gallery-videos/")) {
      const oldAbs = path.join(process.cwd(), "public", current.video_url.replace(/^\//, ""));
      await fs.unlink(oldAbs).catch(() => {});
    }
    if (savedThumbnailPath && current.thumbnail_image?.startsWith("/images/uploads/gallery-video-thumbnails/")) {
      const oldAbs = path.join(process.cwd(), "public", current.thumbnail_image.replace(/^\//, ""));
      await fs.unlink(oldAbs).catch(() => {});
    }

    return NextResponse.json({ success: true, message: "Gallery video updated successfully." });
  } catch (error) {
    console.error("PUT Gallery Video Error:", error);
    for (const filePath of [savedVideoPath, savedThumbnailPath]) {
      if (filePath) {
        try { await fs.unlink(path.join(process.cwd(), "public", filePath.replace(/^\//, ""))); } catch {}
      }
    }
    return jsonError("Failed to update gallery video.", 500);
  } finally {
    if (connection) connection.release();
  }
}

// DELETE /api/gallery-videos/:id (soft-delete record; remove local uploaded files best-effort)
export async function DELETE(request, context) {
  let connection;
  const id = await getId(context);
  if (!id) return jsonError("Invalid video ID.");

  try {
    connection = await pool.getConnection();
    const [rows] = await connection.execute(
      "SELECT id, video_type, video_url, thumbnail_image FROM cst_gallery_videos WHERE id = ? AND is_deleted = 0 LIMIT 1", [id]
    );
    if (!rows.length) return jsonError("Gallery video not found.", 404);

    const video = rows[0];
    await connection.execute("UPDATE cst_gallery_videos SET is_deleted = 1 WHERE id = ?", [id]);

    // Only unlink files inside this API's managed upload directories. External URLs are never deleted.
    const managedPrefixes = [
      "/images/uploads/gallery-videos/",
      "/images/uploads/gallery-video-thumbnails/"
    ];
    const localPaths = [];
    if (video.video_type === "Upload" && video.video_url) localPaths.push(video.video_url);
    if (video.thumbnail_image) localPaths.push(video.thumbnail_image);

    for (const filePath of localPaths) {
      if (!managedPrefixes.some((prefix) => filePath.startsWith(prefix))) continue;
      const absolutePath = path.join(process.cwd(), "public", filePath.replace(/^\//, ""));
      try { await fs.unlink(absolutePath); } catch (error) {
        if (error.code !== "ENOENT") console.error("Gallery video file cleanup error:", error);
      }
    }

    return NextResponse.json({ success: true, message: "Gallery video deleted successfully." });
  } catch (error) {
    console.error("DELETE Gallery Video Error:", error);
    return jsonError("Failed to delete gallery video.", 500);
  } finally {
    if (connection) connection.release();
  }
}
