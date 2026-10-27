"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Film, FolderTree, Images, Video } from "lucide-react";

export default function GalleryNavigationTabs({
    categoryCount,
    albumCount,
    imageCount,
    videoCount,
    actionButton,
}) {
    const pathname = usePathname();

    const isCategories =
        pathname === "/next_panel/gallery-categories" ||
        pathname.startsWith("/next_panel/gallery-categories/");
    const isAlbums =
        pathname === "/next_panel/gallery-albums" ||
        pathname.startsWith("/next_panel/gallery-albums/");
    const isImages =
        pathname === "/next_panel/gallery-images" ||
        pathname.startsWith("/next_panel/gallery-images/");
    const isVideos =
        pathname === "/next_panel/gallery-videos" ||
        pathname.startsWith("/next_panel/gallery-videos/");

    return (
        <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-4 pb-2 border-bottom">
            <ul className="nav nav-pills gap-2">
                <li className="nav-item">
                    <Link
                        href="/next_panel/gallery-categories"
                        className={`nav-link d-flex align-items-center gap-2 fw-semibold px-3 py-2 ${
                            isCategories
                                ? "active bg-primary text-white"
                                : "bg-light text-dark border"
                        }`}
                    >
                        <FolderTree size={17} />
                        <span>Categories</span>
                        {categoryCount !== undefined && (
                            <span
                                className={`badge rounded-pill ${
                                    isCategories
                                        ? "bg-white text-primary"
                                        : "bg-primary text-white"
                                }`}
                            >
                                {categoryCount}
                            </span>
                        )}
                    </Link>
                </li>
                <li className="nav-item">
                    <Link
                        href="/next_panel/gallery-albums"
                        className={`nav-link d-flex align-items-center gap-2 fw-semibold px-3 py-2 ${
                            isAlbums
                                ? "active bg-primary text-white"
                                : "bg-light text-dark border"
                        }`}
                    >
                        <Film size={17} />
                        <span>Albums</span>
                        {albumCount !== undefined && (
                            <span
                                className={`badge rounded-pill ${
                                    isAlbums
                                        ? "bg-white text-primary"
                                        : "bg-primary text-white"
                                }`}
                            >
                                {albumCount}
                            </span>
                        )}
                    </Link>
                </li>
                <li className="nav-item">
                    <Link
                        href="/next_panel/gallery-images"
                        className={`nav-link d-flex align-items-center gap-2 fw-semibold px-3 py-2 ${
                            isImages
                                ? "active bg-primary text-white"
                                : "bg-light text-dark border"
                        }`}
                    >
                        <Images size={17} />
                        <span>Images</span>
                        {imageCount !== undefined && (
                            <span
                                className={`badge rounded-pill ${
                                    isImages
                                        ? "bg-white text-primary"
                                        : "bg-primary text-white"
                                }`}
                            >
                                {imageCount}
                            </span>
                        )}
                    </Link>
                </li>
                <li className="nav-item">
                    <Link
                        href="/next_panel/gallery-videos"
                        className={`nav-link d-flex align-items-center gap-2 fw-semibold px-3 py-2 ${
                            isVideos
                                ? "active bg-primary text-white"
                                : "bg-light text-dark border"
                        }`}
                    >
                        <Video size={17} />
                        <span>Videos</span>
                        {videoCount !== undefined && (
                            <span
                                className={`badge rounded-pill ${
                                    isVideos
                                        ? "bg-white text-primary"
                                        : "bg-primary text-white"
                                }`}
                            >
                                {videoCount}
                            </span>
                        )}
                    </Link>
                </li>
            </ul>

            <div className="d-flex align-items-center gap-2">{actionButton}</div>
        </div>
    );
}
