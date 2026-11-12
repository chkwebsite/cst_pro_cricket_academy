import { NextResponse } from "next/server";
import pool from "@/app/components/lib/db";
import fs from "fs/promises";
import path from "path";

const MAX_VIDEO_SIZE = 20 * 1024 * 1024; // 20 MB
const MAX_THUMBNAIL_SIZE = 2 * 1024 * 1024; // 2 MB
const VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime"];
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

function jsonError(message, status = 400) {
  return NextResponse.json({ success: false, message }, { status });
}

function safeExtension(fileName, fallback) {
  const ext = path.extname(fileName || "").toLowerCase();
  return /^\.[a-z0-9]{1,8}$/.test(ext) ? ext : fallback;
}

async function saveFile(file, folder, fallbackExtension) {
  const uploadDir = path.join(process.cwd(), "public", "images", "uploads", folder);
  await fs.mkdir(uploadDir, { recursive: true });
  const fileName = `${Date.now()}-${crypto.randomUUID()}${safeExtension(file.name, fallbackExtension)}`;
  await fs.writeFile(path.join(uploadDir, fileName), Buffer.from(await file.arrayBuffer()), { flag: "wx" });
  return `/images/uploads/${folder}/${fileName}`;
}

// GET /api/gallery-videos?album_id=1&status=1&search=final
export async function GET(request) {
  let connection;
  try {
    const { searchParams } = new URL(request.url);
    const albumId = searchParams.get("album_id");
    const status = searchParams.get("status");
    const videoType = searchParams.get("video_type");
    const search = (searchParams.get("search") || "").trim();

    connection = await pool.getConnection();
    let sql = `
      SELECT gv.*, ga.album_title, CONCAT_WS(' ', u.first_name, u.last_name) AS uploaded_by_name
      FROM cst_gallery_videos gv
      LEFT JOIN cst_gallery_albums ga ON ga.id = gv.album_id AND ga.is_deleted = 0
      LEFT JOIN cst_users u ON u.id = gv.uploaded_by
      WHERE gv.is_deleted = 0
    `;
    const values = [];

    if (albumId !== null && albumId !== "") {
      sql += " AND gv.album_id = ?";
      values.push(albumId);
    }
    if (status !== null && status !== "") {
      sql += " AND gv.status = ?";
      values.push(status);
    }
    if (videoType) {
      if (!["YouTube", "Vimeo", "Upload"].includes(videoType)) {
        return jsonError("Invalid video_type. Use YouTube, Vimeo or Upload.");
      }
      sql += " AND gv.video_type = ?";
      values.push(videoType);
    }
    if (search) {
      sql += " AND (gv.video_title LIKE ? OR gv.video_url LIKE ?)";
      values.push(`%${search}%`, `%${search}%`);
    }

    sql += " ORDER BY gv.sort_order ASC, gv.id DESC";
    const [rows] = await connection.execute(sql, values);
    return NextResponse.json({ success: true, data: rows });
  } catch (error) {
    console.error("GET Gallery Videos Error:", error);
    return jsonError("Failed to fetch gallery videos", 500);
  } finally {
    if (connection) connection.release();
  }
}

// POST /api/gallery-videos (multipart/form-data)
// YouTube/Vimeo: video_title, video_url, video_type; optional thumbnail_image file.
// Upload: video_title, video_type=Upload, video file in `video`; optional thumbnail_image file.
export async function POST(request) {
  let connection;
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
    const uploadedByRaw = formData.get("uploaded_by");
    const uploaded_by = uploadedByRaw === null || uploadedByRaw === "" ? null : Number(uploadedByRaw);
    const duration = (formData.get("duration") || "").toString().trim() || null;
    const videoFile = formData.get("video");
    const thumbnailFile = formData.get("thumbnail_image");

    if (!video_title) return jsonError("video_title is required.");
    if (!["YouTube", "Vimeo", "Upload"].includes(video_type)) {
      return jsonError("video_type must be YouTube, Vimeo or Upload.");
    }
    if (album_id !== null && (!Number.isInteger(album_id) || album_id < 1)) return jsonError("Invalid album_id.");
    if (!Number.isInteger(sort_order) || sort_order < 0) return jsonError("sort_order must be a non-negative integer.");
    if (![0, 1].includes(status)) return jsonError("status must be 0 or 1.");
    if (uploaded_by !== null && (!Number.isInteger(uploaded_by) || uploaded_by < 1)) return jsonError("Invalid uploaded_by.");

    let video_url = submittedVideoUrl;
    if (video_type === "Upload") {
      if (!videoFile || typeof videoFile.arrayBuffer !== "function" || videoFile.size === 0) {
        return jsonError("For video_type=Upload, provide a video file in the `video` field.");
      }
      if (!VIDEO_TYPES.includes(videoFile.type)) return jsonError("Only MP4, WEBM and MOV videos are allowed.");
      if (videoFile.size > MAX_VIDEO_SIZE) return jsonError("Video file must not exceed 20MB.");
    } else {
      if (!video_url) return jsonError("video_url is required for YouTube and Vimeo videos.");
      let parsedUrl;
      try { parsedUrl = new URL(video_url); } catch { return jsonError("video_url must be a valid URL."); }
      if (parsedUrl.protocol !== "https:" && parsedUrl.protocol !== "http:") return jsonError("video_url must use HTTP or HTTPS.");
      const host = parsedUrl.hostname.toLowerCase();
      if (video_type === "YouTube" && !["youtube.com", "www.youtube.com", "youtu.be", "m.youtube.com", "youtube-nocookie.com", "www.youtube-nocookie.com"].includes(host)) {
        return jsonError("Please provide a valid YouTube URL.");
      }
      if (video_type === "Vimeo" && !(host === "vimeo.com" || host.endsWith(".vimeo.com"))) {
        return jsonError("Please provide a valid Vimeo URL.");
      }
    }

    if (thumbnailFile && typeof thumbnailFile.arrayBuffer === "function" && thumbnailFile.size > 0) {
      if (!IMAGE_TYPES.includes(thumbnailFile.type)) return jsonError("Thumbnail must be JPG, PNG or WEBP.");
      if (thumbnailFile.size > MAX_THUMBNAIL_SIZE) return jsonError("Thumbnail must not exceed 2MB.");
    }

    connection = await pool.getConnection();

    if (album_id !== null) {
      const [albumRows] = await connection.execute(
        "SELECT id FROM cst_gallery_albums WHERE id = ? AND is_deleted = 0 LIMIT 1", [album_id]
      );
      if (!albumRows.length) return jsonError("Invalid album_id or album is deleted.");
    }
    if (uploaded_by !== null) {
      const [userRows] = await connection.execute("SELECT id FROM cst_users WHERE id = ? LIMIT 1", [uploaded_by]);
      if (!userRows.length) return jsonError("Invalid uploaded_by.");
    }

    if (video_type === "Upload") {
      savedVideoPath = await saveFile(videoFile, "gallery-videos", ".mp4");
      video_url = savedVideoPath;
    }
    if (thumbnailFile && typeof thumbnailFile.arrayBuffer === "function" && thumbnailFile.size > 0) {
      savedThumbnailPath = await saveFile(thumbnailFile, "gallery-video-thumbnails", ".jpg");
    }

    const [result] = await connection.execute(
      `INSERT INTO cst_gallery_videos
       (album_id, video_title, video_url, video_type, thumbnail_image, duration, sort_order, status, uploaded_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [album_id, video_title, video_url, video_type, savedThumbnailPath, duration, sort_order, status, uploaded_by]
    );

    const [rows] = await connection.execute(
      `SELECT gv.*, ga.album_title, CONCAT_WS(' ', u.first_name, u.last_name) AS uploaded_by_name
       FROM cst_gallery_videos gv
       LEFT JOIN cst_gallery_albums ga ON ga.id = gv.album_id
       LEFT JOIN cst_users u ON u.id = gv.uploaded_by
       WHERE gv.id = ? LIMIT 1`, [result.insertId]
    );
    return NextResponse.json({ success: true, message: "Gallery video created successfully.", data: rows[0] }, { status: 201 });
  } catch (error) {
    console.error("POST Gallery Videos Error:", error);
    // Clean up files if the database insert failed.
    for (const filePath of [savedVideoPath, savedThumbnailPath]) {
      if (filePath) {
        try { await fs.unlink(path.join(process.cwd(), "public", filePath.replace(/^\//, ""))); } catch {}
      }
    }
    return jsonError("Failed to create gallery video.", 500);
  } finally {
    if (connection) connection.release();
  }
}
