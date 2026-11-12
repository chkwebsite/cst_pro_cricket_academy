"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
    Calendar,
    ChevronLeft,
    ChevronRight,
    Clock,
    ExternalLink,
    Film,
    Folder,
    FolderOpen,
    Image as ImageIcon,
    Images,
    Layers,
    Maximize2,
    Play,
    Search,
    Video,
    X,
    ArrowLeft,
    ArrowRight,
    Tag,
} from "lucide-react";

// ==========================================
// FALLBACK DATA (Used if DB is not populated)
// ==========================================
const FALLBACK_CATEGORIES = [
    { id: "matches", category_name: "Matches", slug: "matches", sort_order: 1 },
    { id: "tournament", category_name: "Tournaments", slug: "tournament", sort_order: 2 },
    { id: "training", category_name: "Training & Practice", slug: "training", sort_order: 3 },
    { id: "events", category_name: "Events & Camps", slug: "events", sort_order: 4 },
];

const FALLBACK_ALBUMS = [
    {
        id: "alb-1",
        category_id: "matches",
        category_name: "Matches",
        category_slug: "matches",
        album_title: "Floodlight Day-Night Derby",
        slug: "floodlight-derby",
        cover_image: "/images/website/scene-night.svg",
        event_date: "2026-10-18",
        description: "Thrilling day-night cricket tournament matches under high-intensity floodlights.",
    },
    {
        id: "alb-2",
        category_id: "matches",
        category_name: "Matches",
        category_slug: "matches",
        album_title: "Inter-Academy League 2026",
        slug: "inter-academy-league",
        cover_image: "/images/website/scene-batting.svg",
        event_date: "2026-10-10",
        description: "Competitive high-stakes league match encounters with top state-level cricket academies.",
    },
    {
        id: "alb-3",
        category_id: "tournament",
        category_name: "Tournaments",
        category_slug: "tournament",
        album_title: "State Championship Trophy",
        slug: "state-championship-trophy",
        cover_image: "/images/website/scene-trophy.svg",
        event_date: "2026-09-28",
        description: "Gold medal and championship trophy presentation ceremonies with honorary guests.",
    },
    {
        id: "alb-4",
        category_id: "tournament",
        category_name: "Tournaments",
        category_slug: "tournament",
        album_title: "Junior Cup Final Thriller",
        slug: "junior-cup-final",
        cover_image: "/images/website/scene-stumps.svg",
        event_date: "2026-09-15",
        description: "Electric match-deciding moments and fierce deliveries from our junior champions.",
    },
    {
        id: "alb-5",
        category_id: "training",
        category_name: "Training & Practice",
        category_slug: "training",
        album_title: "High Performance Drills",
        slug: "high-performance-drills",
        cover_image: "/images/website/program-high-performance.jpg",
        event_date: "2026-10-05",
        description: "Specialized turf pitch nets, pace bowling speeds, and match simulations.",
    },
    {
        id: "alb-6",
        category_id: "training",
        category_name: "Training & Practice",
        category_slug: "training",
        album_title: "Batting Technique Masterclass",
        slug: "batting-technique-masterclass",
        cover_image: "/images/website/program-one-to-two.jpg",
        event_date: "2026-10-02",
        description: "Personalized stance, grip correction, drive mastery, and video review coaching.",
    },
    {
        id: "alb-7",
        category_id: "events",
        category_name: "Events & Camps",
        category_slug: "events",
        album_title: "Residential Summer Camp",
        slug: "residential-summer-camp",
        cover_image: "/images/website/scene-hostel.svg",
        event_date: "2026-08-20",
        description: "Hostel life, recovery sessions, team spirit, and full-day residential training routine.",
    },
    {
        id: "alb-8",
        category_id: "events",
        category_name: "Events & Camps",
        category_slug: "events",
        album_title: "Annual Sports & Fitness Day",
        slug: "annual-sports-fitness-day",
        cover_image: "/images/website/scene-fitness.svg",
        event_date: "2026-08-12",
        description: "Academy endurance challenges, agility ladder drills, sprint tests, and annual honors.",
    },
];

const FALLBACK_IMAGES = [
    // Floodlight Derby (alb-1)
    {
        id: "fb-1",
        album_id: "alb-1",
        album_title: "Floodlight Day-Night Derby",
        category_slug: "matches",
        category_name: "Matches",
        image_path: "/images/website/scene-night.svg",
        image_caption: "Center Pitch Under High-Powered Floodlights",
        alt_text: "Cricket stadium illuminated under floodlights",
    },
    {
        id: "fb-2",
        album_id: "alb-1",
        album_title: "Floodlight Day-Night Derby",
        category_slug: "matches",
        category_name: "Matches",
        image_path: "/images/website/scene-catch.svg",
        image_caption: "Spectacular Slip Catch Under Lights",
        alt_text: "Fielder diving to take catch in slips",
    },
    {
        id: "fb-3",
        album_id: "alb-1",
        album_title: "Floodlight Day-Night Derby",
        category_slug: "matches",
        category_name: "Matches",
        image_path: "/images/website/scene-scoreboard.svg",
        image_caption: "Chasing 186 in Last-Over Thriller",
        alt_text: "Cricket stadium digital scoreboard",
    },

    // Inter-Academy League (alb-2)
    {
        id: "fb-4",
        album_id: "alb-2",
        album_title: "Inter-Academy League 2026",
        category_slug: "matches",
        category_name: "Matches",
        image_path: "/images/website/scene-batting.svg",
        image_caption: "Classic Cover Drive on the Rise",
        alt_text: "Batter playing a classic cover drive",
    },
    {
        id: "fb-5",
        album_id: "alb-2",
        album_title: "Inter-Academy League 2026",
        category_slug: "matches",
        category_name: "Matches",
        image_path: "/images/website/scene-bowling.svg",
        image_caption: "Fast Bowling Yorker Delivery",
        alt_text: "Pace bowler in delivery stride",
    },
    {
        id: "fb-6",
        album_id: "alb-2",
        album_title: "Inter-Academy League 2026",
        category_slug: "matches",
        category_name: "Matches",
        image_path: "/images/website/scene-helmet.svg",
        image_caption: "Player Gear & Batting Armor",
        alt_text: "Cricket helmet and batting gloves",
    },

    // State Championship Trophy (alb-3)
    {
        id: "fb-7",
        album_id: "alb-3",
        album_title: "State Championship Trophy",
        category_slug: "tournament",
        category_name: "Tournaments",
        image_path: "/images/website/scene-trophy.svg",
        image_caption: "Lifting the State Champions Trophy",
        alt_text: "Gold cricket championship trophy celebration",
    },
    {
        id: "fb-8",
        album_id: "alb-3",
        album_title: "State Championship Trophy",
        category_slug: "tournament",
        category_name: "Tournaments",
        image_path: "/images/website/scene-team.svg",
        image_caption: "Official Academy Squad & Coaches Portrait",
        alt_text: "Academy cricketers team portrait with medals",
    },

    // Junior Cup Final (alb-4)
    {
        id: "fb-9",
        album_id: "alb-4",
        album_title: "Junior Cup Final Thriller",
        category_slug: "tournament",
        category_name: "Tournaments",
        image_path: "/images/website/scene-stumps.svg",
        image_caption: "Flying Stumps on Final Ball Clean Bowled",
        alt_text: "Flying stumps after fast bowling yorker",
    },
    {
        id: "fb-10",
        album_id: "alb-4",
        album_title: "Junior Cup Final Thriller",
        category_slug: "tournament",
        category_name: "Tournaments",
        image_path: "/images/website/scene-catch.svg",
        image_caption: "Wicketkeeper Diving Catch to Clinch Title",
        alt_text: "Wicketkeeper taking flying catch",
    },

    // High Performance Drills (alb-5)
    {
        id: "fb-11",
        album_id: "alb-5",
        album_title: "High Performance Drills",
        category_slug: "training",
        category_name: "Training & Practice",
        image_path: "/images/website/program-high-performance.jpg",
        image_caption: "Turf Pitch Net Coaching Session",
        alt_text: "Coaches training players in net sessions",
    },
    {
        id: "fb-12",
        album_id: "alb-5",
        album_title: "High Performance Drills",
        category_slug: "training",
        category_name: "Training & Practice",
        image_path: "/images/website/program-small-group.jpg",
        image_caption: "Focused Small Group Fielding Drills",
        alt_text: "Small group batting and fielding practice",
    },

    // Batting Technique Masterclass (alb-6)
    {
        id: "fb-13",
        album_id: "alb-6",
        album_title: "Batting Technique Masterclass",
        category_slug: "training",
        category_name: "Training & Practice",
        image_path: "/images/website/program-one-to-two.jpg",
        image_caption: "1-on-2 Detailed Stance Correction",
        alt_text: "Coach correcting young batter grip and stance",
    },
    {
        id: "fb-14",
        album_id: "alb-6",
        album_title: "Batting Technique Masterclass",
        category_slug: "training",
        category_name: "Training & Practice",
        image_path: "/images/website/program-one-to-one.jpg",
        image_caption: "Personal Bat Flow & Head Position Drill",
        alt_text: "Personal batting coaching session",
    },

    // Residential Summer Camp (alb-7)
    {
        id: "fb-15",
        album_id: "alb-7",
        album_title: "Residential Summer Camp",
        category_slug: "events",
        category_name: "Events & Camps",
        image_path: "/images/website/scene-hostel.svg",
        image_caption: "Residential Campus & Accommodation",
        alt_text: "Academy residential facility hostel",
    },
    {
        id: "fb-16",
        album_id: "alb-7",
        album_title: "Residential Summer Camp",
        category_slug: "events",
        category_name: "Events & Camps",
        image_path: "/images/website/scene-fitness.svg",
        image_caption: "Early Morning Camp Warm-Up Run",
        alt_text: "Campers running at sunrise on cricket ground",
    },

    // Annual Sports & Fitness Day (alb-8)
    {
        id: "fb-17",
        album_id: "alb-8",
        album_title: "Annual Sports & Fitness Day",
        category_slug: "events",
        category_name: "Events & Camps",
        image_path: "/images/website/scene-fitness.svg",
        image_caption: "Agility Ladder & Sprint Conditioning",
        alt_text: "Fitness drills and agility ladder training",
    },
    {
        id: "fb-18",
        album_id: "alb-8",
        album_title: "Annual Sports & Fitness Day",
        category_slug: "events",
        category_name: "Events & Camps",
        image_path: "/images/website/scene-team.svg",
        image_caption: "Annual Fitness Award Winners",
        alt_text: "Academy cricketers celebrating fitness milestone",
    },
];

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

export default function GalleryGridSection({
    tag = "Photo & Video Gallery",
    title = "Life at CST Cricket Academy",
    subtitle = "Explore real moments from match days, net practices, tournaments, and fitness camps.",
}) {
    // -------------------------------------------------------------
    // Data state
    // -------------------------------------------------------------
    const [categories, setCategories] = useState([]);
    const [albums, setAlbums] = useState([]);
    const [images, setImages] = useState([]);
    const [videos, setVideos] = useState([]);
    const [loading, setLoading] = useState(true);

    // -------------------------------------------------------------
    // Navigation & Selection state
    // -------------------------------------------------------------
    // activeCategory: "all" or category.id / slug
    const [activeCategory, setActiveCategory] = useState("all");
    // selectedAlbum: null (showing albums list) or album object (showing album's images)
    const [selectedAlbum, setSelectedAlbum] = useState(null);
    // Album content tab: "photos" | "videos"
    const [albumTab, setAlbumTab] = useState("photos");
    // Search query
    const [searchQuery, setSearchQuery] = useState("");

    // -------------------------------------------------------------
    // Lightbox & Video Player modal state
    // -------------------------------------------------------------
    const [lightboxIndex, setLightboxIndex] = useState(null);
    const [activeVideo, setActiveVideo] = useState(null);

    // -------------------------------------------------------------
    // Fetch data from backend APIs (with fallback support)
    // -------------------------------------------------------------
    useEffect(() => {
        let isMounted = true;

        async function fetchGalleryData() {
            try {
                setLoading(true);
                const [catsRes, albumsRes, imagesRes, videosRes] = await Promise.all([
                    fetch("/api/gallery-categories?status=1").catch(() => null),
                    fetch("/api/gallery-albums?status=1").catch(() => null),
                    fetch("/api/gallery-images?status=1").catch(() => null),
                    fetch("/api/gallery-videos?status=1").catch(() => null),
                ]);

                const [catsJson, albumsJson, imagesJson, videosJson] = await Promise.all([
                    catsRes?.ok ? catsRes.json() : null,
                    albumsRes?.ok ? albumsRes.json() : null,
                    imagesRes?.ok ? imagesRes.json() : null,
                    videosRes?.ok ? videosRes.json() : null,
                ]);

                if (!isMounted) return;

                const loadedCats = catsJson?.success && Array.isArray(catsJson.data) && catsJson.data.length > 0
                    ? catsJson.data
                    : FALLBACK_CATEGORIES;

                const loadedAlbums = albumsJson?.success && Array.isArray(albumsJson.data) && albumsJson.data.length > 0
                    ? albumsJson.data
                    : FALLBACK_ALBUMS;

                const loadedImages = imagesJson?.success && Array.isArray(imagesJson.data) && imagesJson.data.length > 0
                    ? imagesJson.data
                    : FALLBACK_IMAGES;

                const loadedVideos = videosJson?.success && Array.isArray(videosJson.data) ? videosJson.data : [];

                setCategories(loadedCats);
                setAlbums(loadedAlbums);
                setImages(loadedImages);
                setVideos(loadedVideos);
            } catch (err) {
                console.error("Gallery fetch error:", err);
                if (isMounted) {
                    setCategories(FALLBACK_CATEGORIES);
                    setAlbums(FALLBACK_ALBUMS);
                    setImages(FALLBACK_IMAGES);
                }
            } finally {
                if (isMounted) setLoading(false);
            }
        }

        fetchGalleryData();

        return () => {
            isMounted = false;
        };
    }, []);

    // -------------------------------------------------------------
    // Helper: count albums in a category
    // -------------------------------------------------------------
    const getCategoryAlbumCount = useCallback((catKey) => {
        if (catKey === "all") return albums.length;
        return albums.filter((a) => {
            if (a.category_id && String(a.category_id) === String(catKey)) return true;
            if (a.category_slug && a.category_slug === catKey) return true;
            if (a.slug && a.slug === catKey) return true;
            return false;
        }).length;
    }, [albums]);

    // -------------------------------------------------------------
    // Helper: count photos in an album
    // -------------------------------------------------------------
    const getAlbumPhotoCount = useCallback((albumId, albumTitle) => {
        return images.filter((img) => {
            if (img.album_id && String(img.album_id) === String(albumId)) return true;
            if (albumTitle && img.album_title && img.album_title.toLowerCase() === albumTitle.toLowerCase()) return true;
            return false;
        }).length;
    }, [images]);

    // -------------------------------------------------------------
    // Helper: count videos in an album
    // -------------------------------------------------------------
    const getAlbumVideoCount = useCallback((albumId, albumTitle) => {
        return videos.filter((vid) => {
            if (vid.album_id && String(vid.album_id) === String(albumId)) return true;
            if (albumTitle && vid.album_title && vid.album_title.toLowerCase() === albumTitle.toLowerCase()) return true;
            return false;
        }).length;
    }, [videos]);

    // -------------------------------------------------------------
    // Filtered Albums (Right side Level 1)
    // -------------------------------------------------------------
    const filteredAlbums = useMemo(() => {
        return albums.filter((alb) => {
            // Category filter
            if (activeCategory !== "all") {
                const matchCat =
                    (alb.category_id && String(alb.category_id) === String(activeCategory)) ||
                    (alb.category_slug && alb.category_slug === activeCategory) ||
                    (alb.slug && alb.slug === activeCategory);
                if (!matchCat) return false;
            }

            // Search query filter
            if (searchQuery.trim() && !selectedAlbum) {
                const q = searchQuery.toLowerCase();
                const title = (alb.album_title || "").toLowerCase();
                const desc = (alb.description || "").toLowerCase();
                const cat = (alb.category_name || "").toLowerCase();
                if (!title.includes(q) && !desc.includes(q) && !cat.includes(q)) return false;
            }

            return true;
        });
    }, [albums, activeCategory, searchQuery, selectedAlbum]);

    // -------------------------------------------------------------
    // Current Album Photos & Videos (Right side Level 2)
    // -------------------------------------------------------------
    const currentAlbumImages = useMemo(() => {
        if (!selectedAlbum) return [];
        return images.filter((img) => {
            const matchesAlbum =
                (img.album_id && String(img.album_id) === String(selectedAlbum.id)) ||
                (img.album_title && selectedAlbum.album_title && img.album_title.toLowerCase() === selectedAlbum.album_title.toLowerCase());

            if (!matchesAlbum) return false;

            // Search query inside album
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase();
                const caption = (img.image_caption || "").toLowerCase();
                const alt = (img.alt_text || "").toLowerCase();
                if (!caption.includes(q) && !alt.includes(q)) return false;
            }

            return true;
        });
    }, [images, selectedAlbum, searchQuery]);

    const currentAlbumVideos = useMemo(() => {
        if (!selectedAlbum) return [];
        return videos.filter((vid) => {
            const matchesAlbum =
                (vid.album_id && String(vid.album_id) === String(selectedAlbum.id)) ||
                (vid.album_title && selectedAlbum.album_title && vid.album_title.toLowerCase() === selectedAlbum.album_title.toLowerCase());

            if (!matchesAlbum) return false;

            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase();
                const title = (vid.video_title || "").toLowerCase();
                if (!title.includes(q)) return false;
            }

            return true;
        });
    }, [videos, selectedAlbum, searchQuery]);

    // -------------------------------------------------------------
    // Active category label helper
    // -------------------------------------------------------------
    const activeCategoryLabel = useMemo(() => {
        if (activeCategory === "all") return "All Categories";
        const found = categories.find(
            (c) => String(c.id) === String(activeCategory) || c.slug === activeCategory
        );
        return found ? found.category_name : "Category";
    }, [categories, activeCategory]);

    // -------------------------------------------------------------
    // Lightbox navigation handlers
    // -------------------------------------------------------------
    const lightboxItems = currentAlbumImages;

    const openLightbox = (index) => {
        setLightboxIndex(index);
    };

    const closeLightbox = () => {
        setLightboxIndex(null);
    };

    const nextImage = useCallback(() => {
        if (lightboxItems.length === 0) return;
        setLightboxIndex((prev) => (prev + 1) % lightboxItems.length);
    }, [lightboxItems.length]);

    const prevImage = useCallback(() => {
        if (lightboxItems.length === 0) return;
        setLightboxIndex((prev) => (prev - 1 + lightboxItems.length) % lightboxItems.length);
    }, [lightboxItems.length]);

    // Keyboard navigation (ArrowLeft, ArrowRight, Escape)
    useEffect(() => {
        if (lightboxIndex === null) return;

        const handleKeyDown = (e) => {
            if (e.key === "Escape") closeLightbox();
            if (e.key === "ArrowRight") nextImage();
            if (e.key === "ArrowLeft") prevImage();
        };

        window.addEventListener("keydown", handleKeyDown);
        document.body.style.overflow = "hidden";

        return () => {
            window.removeEventListener("keydown", handleKeyDown);
            document.body.style.overflow = "unset";
        };
    }, [lightboxIndex, nextImage, prevImage]);

    // Lock body on video modal
    useEffect(() => {
        if (activeVideo) {
            document.body.style.overflow = "hidden";
        } else if (lightboxIndex === null) {
            document.body.style.overflow = "unset";
        }
    }, [activeVideo, lightboxIndex]);

    // Handle category click (resets album view)
    const handleCategoryClick = (catKey) => {
        setActiveCategory(catKey);
        setSelectedAlbum(null);
        setAlbumTab("photos");
        setSearchQuery("");
    };

    // Handle back to albums
    const handleBackToAlbums = () => {
        setSelectedAlbum(null);
        setAlbumTab("photos");
        setSearchQuery("");
    };

    return (
        <section className="py-5 bg-white">
            <div className="container">
                {/* Heading */}
                <div className="text-center mb-5 reveal">
                    <span className="section-tag">{tag}</span>
                    <h2 className="section-title">{title}</h2>
                    <div className="divider"></div>
                    {subtitle && <p className="text-secondary max-w-700 mx-auto">{subtitle}</p>}
                </div>

                {/* Mobile Category Horizontal Scrolling Strip */}
                <div className="d-lg-none mb-4">
                    <div className="gallery-mobile-scroll">
                        <button
                            type="button"
                            className={`gallery-mobile-pill ${activeCategory === "all" ? "active" : ""}`}
                            onClick={() => handleCategoryClick("all")}
                        >
                            <Folder size={14} />
                            All Categories
                            <span className="badge rounded-pill bg-danger ms-1">
                                {albums.length}
                            </span>
                        </button>
                        {categories.map((cat) => {
                            const catKey = String(cat.id || cat.slug);
                            const isSelected =
                                String(activeCategory) === String(cat.id) ||
                                activeCategory === cat.slug;
                            const count = getCategoryAlbumCount(catKey);
                            return (
                                <button
                                    key={`mob-cat-${catKey}`}
                                    type="button"
                                    className={`gallery-mobile-pill ${isSelected ? "active" : ""}`}
                                    onClick={() => handleCategoryClick(catKey)}
                                >
                                    <Tag size={13} />
                                    {cat.category_name}
                                    <span className={`badge rounded-pill ${isSelected ? "bg-white text-dark" : "bg-light text-dark"} ms-1`}>
                                        {count}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Main Two-Column Layout */}
                <div className="row g-4">
                    {/* LEFT COLUMN: Categories List (Desktop Sidebar) */}
                    <div className="col-12 col-lg-3 col-xl-3 d-none d-lg-block">
                        <div className="gallery-sidebar-sticky">
                            <div className="gallery-categories-card">
                                <div className="gallery-categories-title">
                                    <span className="d-flex align-items-center gap-2">
                                        <Layers size={18} className="text-red" />
                                        Categories
                                    </span>
                                    <span className="badge bg-light text-dark small fw-bold">
                                        {categories.length}
                                    </span>
                                </div>

                                <div className="gallery-cat-list">
                                    {/* All Categories Option */}
                                    <button
                                        type="button"
                                        className={`gallery-cat-btn ${activeCategory === "all" ? "active" : ""}`}
                                        onClick={() => handleCategoryClick("all")}
                                    >
                                        <span className="d-flex align-items-center gap-2 text-truncate">
                                            {activeCategory === "all" ? (
                                                <FolderOpen size={17} className="text-red" />
                                            ) : (
                                                <Folder size={17} className="text-secondary opacity-75" />
                                            )}
                                            All Categories
                                        </span>
                                        <span className="gallery-cat-badge">
                                            {albums.length}
                                        </span>
                                    </button>

                                    {/* Dynamic Categories */}
                                    {categories.map((cat) => {
                                        const catKey = String(cat.id || cat.slug);
                                        const isSelected =
                                            String(activeCategory) === String(cat.id) ||
                                            activeCategory === cat.slug;
                                        const count = getCategoryAlbumCount(catKey);

                                        return (
                                            <button
                                                key={`desktop-cat-${catKey}`}
                                                type="button"
                                                className={`gallery-cat-btn ${isSelected ? "active" : ""}`}
                                                onClick={() => handleCategoryClick(catKey)}
                                            >
                                                <span className="d-flex align-items-center gap-2 text-truncate">
                                                    {isSelected ? (
                                                        <FolderOpen size={17} className="text-red" />
                                                    ) : (
                                                        <Folder size={17} className="text-secondary opacity-75" />
                                                    )}
                                                    {cat.category_name}
                                                </span>
                                                <span className="gallery-cat-badge">
                                                    {count}
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* RIGHT COLUMN: Albums & Images Content Area */}
                    <div className="col-12 col-lg-9 col-xl-9">
                        {/* ------------------------------------------------------------- */}
                        {/* CASE A: ALBUM IS SELECTED -> SHOW ALBUM'S IMAGES             */}
                        {/* ------------------------------------------------------------- */}
                        {selectedAlbum ? (
                            <div>
                                {/* Album Header Banner */}
                                <div className="gallery-album-banner">
                                    <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-3">
                                        <button
                                            type="button"
                                            className="gallery-back-btn"
                                            onClick={handleBackToAlbums}
                                        >
                                            <ArrowLeft size={16} />
                                            Back to Albums
                                        </button>

                                        {/* Breadcrumbs */}
                                        <div className="small text-muted d-flex align-items-center gap-1">
                                            <span
                                                className="text-decoration-underline cursor-pointer"
                                                onClick={handleBackToAlbums}
                                                style={{ cursor: "pointer" }}
                                            >
                                                {activeCategoryLabel}
                                            </span>
                                            <span>/</span>
                                            <span className="fw-semibold text-dark text-truncate" style={{ maxWidth: "200px" }}>
                                                {selectedAlbum.album_title}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Album Title & Meta */}
                                    <div className="row g-3 align-items-center justify-content-between">
                                        <div className="col-12 col-md-8">
                                            <h3 className="fw-bold mb-2 text-navy">
                                                {selectedAlbum.album_title}
                                            </h3>
                                            {selectedAlbum.description && (
                                                <p className="text-secondary small mb-2">
                                                    {selectedAlbum.description}
                                                </p>
                                            )}
                                            <div className="d-flex flex-wrap align-items-center gap-2">
                                                {selectedAlbum.category_name && (
                                                    <span className="badge bg-red small px-3 py-1">
                                                        {selectedAlbum.category_name}
                                                    </span>
                                                )}
                                                {selectedAlbum.event_date && (
                                                    <span className="badge bg-light text-dark border small px-2 py-1 d-inline-flex align-items-center gap-1">
                                                        <Calendar size={12} className="text-muted" />
                                                        {new Date(selectedAlbum.event_date).toLocaleDateString("en-US", {
                                                            year: "numeric",
                                                            month: "short",
                                                            day: "numeric",
                                                        })}
                                                    </span>
                                                )}
                                                <span className="badge bg-navy text-white small px-2 py-1 d-inline-flex align-items-center gap-1">
                                                    <ImageIcon size={12} />
                                                    {currentAlbumImages.length} Photos
                                                </span>
                                                {currentAlbumVideos.length > 0 && (
                                                    <span className="badge bg-dark text-white small px-2 py-1 d-inline-flex align-items-center gap-1">
                                                        <Video size={12} />
                                                        {currentAlbumVideos.length} Videos
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        {/* Search in Album */}
                                        <div className="col-12 col-md-4">
                                            <div className="input-group input-group-sm">
                                                <span className="input-group-text bg-white border-end-0">
                                                    <Search size={14} className="text-muted" />
                                                </span>
                                                <input
                                                    type="text"
                                                    className="form-control border-start-0"
                                                    placeholder="Search photos in album..."
                                                    value={searchQuery}
                                                    onChange={(e) => setSearchQuery(e.target.value)}
                                                />
                                                {searchQuery && (
                                                    <button
                                                        type="button"
                                                        className="btn btn-outline-secondary"
                                                        onClick={() => setSearchQuery("")}
                                                    >
                                                        <X size={14} />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Tabs if videos exist in this album */}
                                    {currentAlbumVideos.length > 0 && (
                                        <div className="d-flex gap-2 mt-3 pt-3 border-top">
                                            <button
                                                type="button"
                                                className={`gallery-media-type-btn ${albumTab === "photos" ? "active" : ""}`}
                                                onClick={() => setAlbumTab("photos")}
                                            >
                                                <Images size={14} className="me-1" />
                                                Photos ({currentAlbumImages.length})
                                            </button>
                                            <button
                                                type="button"
                                                className={`gallery-media-type-btn ${albumTab === "videos" ? "active" : ""}`}
                                                onClick={() => setAlbumTab("videos")}
                                            >
                                                <Video size={14} className="me-1" />
                                                Videos ({currentAlbumVideos.length})
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {/* PHOTOS GRID */}
                                {albumTab === "photos" && (
                                    <>
                                        {currentAlbumImages.length === 0 ? (
                                            <div className="text-center py-5 bg-light rounded-4">
                                                <ImageIcon size={44} className="text-secondary opacity-50 mb-3 mx-auto" />
                                                <h5>No photos found in this album</h5>
                                                <p className="text-muted small">
                                                    {searchQuery ? "Try clearing your search query." : "No pictures have been uploaded to this album yet."}
                                                </p>
                                                <button
                                                    type="button"
                                                    className="btn btn-sm btn-outline-dark"
                                                    onClick={handleBackToAlbums}
                                                >
                                                    <ArrowLeft size={14} className="me-1" /> Back to Albums
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="row g-3 g-md-4">
                                                {currentAlbumImages.map((img, idx) => (
                                                    <div
                                                        key={`album-photo-${img.id || idx}`}
                                                        className="col-6 col-sm-6 col-md-4 col-lg-3"
                                                        onClick={() => openLightbox(idx)}
                                                    >
                                                        <div className="gallery-photo-box">
                                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                                            <img
                                                                src={img.image_path}
                                                                alt={img.alt_text || img.image_caption || selectedAlbum.album_title}
                                                                loading="lazy"
                                                            />
                                                            <div className="gallery-photo-overlay">
                                                                <div className="gallery-photo-zoom-icon">
                                                                    <Maximize2 size={16} />
                                                                </div>
                                                                {img.image_caption && (
                                                                    <div className="gallery-photo-caption">
                                                                        {img.image_caption}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </>
                                )}

                                {/* VIDEOS GRID (if album has videos) */}
                                {albumTab === "videos" && (
                                    <div className="row g-3 g-md-4">
                                        {currentAlbumVideos.map((vid, vIdx) => (
                                            <div
                                                key={`album-vid-${vid.id || vIdx}`}
                                                className="col-6 col-sm-6 col-md-4 col-lg-4"
                                                onClick={() => setActiveVideo(vid)}
                                            >
                                                <div className="gallery-photo-box position-relative">
                                                    {vid.thumbnail_image ? (
                                                        /* eslint-disable-next-line @next/next/no-img-element */
                                                        <img
                                                            src={vid.thumbnail_image}
                                                            alt={vid.video_title}
                                                            loading="lazy"
                                                        />
                                                    ) : (
                                                        <div className="w-100 h-100 d-flex align-items-center justify-content-center bg-navy text-white-50">
                                                            <Video size={36} />
                                                        </div>
                                                    )}
                                                    <div className="play-badge">
                                                        <Play size={20} fill="currentColor" className="ms-1" />
                                                    </div>
                                                    {vid.duration && (
                                                        <span
                                                            className="badge bg-dark bg-opacity-75 text-white position-absolute top-0 end-0 m-2 small d-inline-flex align-items-center gap-1"
                                                            style={{ zIndex: 3 }}
                                                        >
                                                            <Clock size={11} /> {vid.duration}
                                                        </span>
                                                    )}
                                                    <div className="gallery-photo-overlay opacity-100">
                                                        <div />
                                                        <div className="gallery-photo-caption">
                                                            {vid.video_title}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ) : (
                            /* ------------------------------------------------------------- */
                            /* CASE B: NO ALBUM SELECTED -> SHOW ALBUMS OF CATEGORY          */
                            /* ------------------------------------------------------------- */
                            <div>
                                {/* Sub-bar: Category Info & Search */}
                                <div className="bg-light rounded-4 p-3 mb-4 shadow-sm">
                                    <div className="row g-3 align-items-center justify-content-between">
                                        <div className="col-12 col-md-auto d-flex align-items-center gap-2">
                                            <Film size={20} className="text-red" />
                                            <div>
                                                <h5 className="mb-0 fw-bold text-navy">
                                                    {activeCategoryLabel}
                                                </h5>
                                                <span className="text-muted small">
                                                    {filteredAlbums.length}{" "}
                                                    {filteredAlbums.length === 1 ? "album" : "albums"} available
                                                </span>
                                            </div>
                                        </div>

                                        {/* Search albums */}
                                        <div className="col-12 col-md-4 col-lg-4">
                                            <div className="input-group input-group-sm">
                                                <span className="input-group-text bg-white border-end-0">
                                                    <Search size={14} className="text-muted" />
                                                </span>
                                                <input
                                                    type="text"
                                                    className="form-control border-start-0"
                                                    placeholder="Search albums..."
                                                    value={searchQuery}
                                                    onChange={(e) => setSearchQuery(e.target.value)}
                                                />
                                                {searchQuery && (
                                                    <button
                                                        type="button"
                                                        className="btn btn-outline-secondary"
                                                        onClick={() => setSearchQuery("")}
                                                    >
                                                        <X size={14} />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Loading state */}
                                {loading ? (
                                    <div className="text-center py-5 text-muted">
                                        <div className="spinner-border text-red me-2" role="status" />
                                        Loading albums...
                                    </div>
                                ) : filteredAlbums.length === 0 ? (
                                    <div className="text-center py-5 text-muted bg-light rounded-4">
                                        <Film size={44} className="text-secondary opacity-50 mb-3 mx-auto" />
                                        <h5>No albums found</h5>
                                        <p className="small">
                                            {searchQuery
                                                ? "Try clearing your search query."
                                                : "No albums exist in this category yet."}
                                        </p>
                                        <button
                                            type="button"
                                            className="btn btn-red btn-sm"
                                            onClick={() => {
                                                setActiveCategory("all");
                                                setSearchQuery("");
                                            }}
                                        >
                                            View All Albums
                                        </button>
                                    </div>
                                ) : (
                                    /* ALBUMS GRID */
                                    <div className="row g-3 g-lg-4">
                                        {filteredAlbums.map((album) => {
                                            const photoCount = getAlbumPhotoCount(album.id, album.album_title);
                                            const videoCount = getAlbumVideoCount(album.id, album.album_title);
                                            const coverImg =
                                                album.cover_image ||
                                                images.find((img) => String(img.album_id) === String(album.id))?.image_path ||
                                                "/images/website/scene-team.svg";

                                            return (
                                                <div
                                                    key={`alb-${album.id}`}
                                                    className="col-12 col-sm-6 col-lg-4"
                                                    onClick={() => {
                                                        setSelectedAlbum(album);
                                                        setAlbumTab("photos");
                                                        setSearchQuery("");
                                                    }}
                                                >
                                                    <div className="gallery-album-box">
                                                        {/* Cover Image */}
                                                        <div className="gallery-album-img-wrap">
                                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                                            <img
                                                                src={coverImg}
                                                                alt={album.album_title}
                                                                loading="lazy"
                                                            />
                                                            {album.category_name && (
                                                                <span className="badge bg-red position-absolute top-0 start-0 m-2 small">
                                                                    {album.category_name}
                                                                </span>
                                                            )}
                                                            <span className="badge bg-dark bg-opacity-75 text-white position-absolute top-0 end-0 m-2 small d-inline-flex align-items-center gap-1">
                                                                <ImageIcon size={11} />
                                                                {photoCount} {photoCount === 1 ? "Photo" : "Photos"}
                                                            </span>
                                                        </div>

                                                        {/* Details */}
                                                        <div className="gallery-album-content">
                                                            <h5 className="gallery-album-title" title={album.album_title}>
                                                                {album.album_title}
                                                            </h5>

                                                            {album.description && (
                                                                <p className="gallery-album-desc">
                                                                    {album.description}
                                                                </p>
                                                            )}

                                                            <div className="gallery-album-footer">
                                                                <span className="text-muted d-flex align-items-center gap-1 small">
                                                                    {album.event_date ? (
                                                                        <>
                                                                            <Calendar size={13} />
                                                                            {new Date(album.event_date).toLocaleDateString("en-US", {
                                                                                month: "short",
                                                                                day: "numeric",
                                                                                year: "numeric",
                                                                            })}
                                                                        </>
                                                                    ) : (
                                                                        <>
                                                                            <Film size={13} />
                                                                            ST Academy
                                                                        </>
                                                                    )}
                                                                </span>

                                                                <span className="text-red fw-bold small d-inline-flex align-items-center gap-1">
                                                                    View Photos <ChevronRight size={14} />
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* ============================================================= */}
            {/* LIGHTBOX MODAL (Big Image with Prev / Next Navigation)       */}
            {/* ============================================================= */}
            {lightboxIndex !== null && lightboxItems[lightboxIndex] && (
                <div
                    className="gallery-lightbox-overlay"
                    onClick={closeLightbox}
                    role="dialog"
                    aria-modal="true"
                >
                    {/* Header */}
                    <div className="gallery-lightbox-header" onClick={(e) => e.stopPropagation()}>
                        <div className="d-flex align-items-center gap-2">
                            <span className="badge bg-red px-3 py-1">
                                {lightboxIndex + 1} of {lightboxItems.length}
                            </span>
                            {selectedAlbum && (
                                <span className="text-light small opacity-75 d-none d-sm-inline">
                                    • {selectedAlbum.album_title}
                                </span>
                            )}
                        </div>
                        <button
                            type="button"
                            className="btn btn-outline-light btn-sm rounded-circle p-2"
                            onClick={closeLightbox}
                            aria-label="Close Lightbox"
                        >
                            <X size={22} />
                        </button>
                    </div>

                    {/* Body: Prev + Image + Next */}
                    <div className="gallery-lightbox-body" onClick={(e) => e.stopPropagation()}>
                        {lightboxItems.length > 1 && (
                            <button
                                type="button"
                                className="gallery-lightbox-nav-btn prev"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    prevImage();
                                }}
                                aria-label="Previous photo"
                            >
                                <ChevronLeft size={28} />
                            </button>
                        )}

                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                            src={lightboxItems[lightboxIndex].image_path}
                            alt={
                                lightboxItems[lightboxIndex].alt_text ||
                                lightboxItems[lightboxIndex].image_caption ||
                                "Full resolution photo"
                            }
                            className="gallery-lightbox-img"
                        />

                        {lightboxItems.length > 1 && (
                            <button
                                type="button"
                                className="gallery-lightbox-nav-btn next"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    nextImage();
                                }}
                                aria-label="Next photo"
                            >
                                <ChevronRight size={28} />
                            </button>
                        )}
                    </div>

                    {/* Footer / Caption */}
                    <div className="gallery-lightbox-footer" onClick={(e) => e.stopPropagation()}>
                        <h5 className="mb-1 text-white">
                            {lightboxItems[lightboxIndex].image_caption ||
                                selectedAlbum?.album_title ||
                                "CST Cricket Academy Moment"}
                        </h5>
                        {lightboxItems[lightboxIndex].alt_text && (
                            <p className="small text-white-50 mb-0">
                                {lightboxItems[lightboxIndex].alt_text}
                            </p>
                        )}
                        <span className="small text-white-50 d-none d-md-inline-block mt-1">
                            Tip: Use Left (←) &amp; Right (→) arrow keys to navigate, Esc to close
                        </span>
                    </div>
                </div>
            )}

            {/* ============================================================= */}
            {/* VIDEO PLAYER MODAL                                           */}
            {/* ============================================================= */}
            {activeVideo && (
                <div
                    className="gallery-lightbox-overlay"
                    onClick={() => setActiveVideo(null)}
                    role="dialog"
                    aria-modal="true"
                >
                    <div
                        className="gallery-lightbox-header w-100 max-w-900 mx-auto"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h6 className="mb-0 text-white text-truncate me-3">
                            {activeVideo.video_title}
                        </h6>
                        <button
                            type="button"
                            className="btn btn-outline-light btn-sm rounded-circle p-2"
                            onClick={() => setActiveVideo(null)}
                            aria-label="Close Video"
                        >
                            <X size={20} />
                        </button>
                    </div>

                    <div
                        className="gallery-lightbox-body w-100 max-w-900 mx-auto"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div
                            className="ratio ratio-16x9 w-100 rounded-4 overflow-hidden shadow-lg"
                            style={{ maxHeight: "80vh" }}
                        >
                            {activeVideo.video_type === "Upload" ? (
                                <video
                                    src={activeVideo.video_url}
                                    controls
                                    autoPlay
                                    poster={activeVideo.thumbnail_image}
                                    className="w-100 h-100"
                                />
                            ) : getEmbedUrl(activeVideo.video_type, activeVideo.video_url) ? (
                                <iframe
                                    src={getEmbedUrl(activeVideo.video_type, activeVideo.video_url)}
                                    title={activeVideo.video_title}
                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                    allowFullScreen
                                    className="w-100 h-100 border-0"
                                />
                            ) : (
                                <div className="d-flex flex-column align-items-center justify-content-center bg-dark text-white p-4">
                                    <p className="mb-2">Unable to embed this video.</p>
                                    <a
                                        href={activeVideo.video_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="btn btn-danger btn-sm"
                                    >
                                        Watch on {activeVideo.video_type}{" "}
                                        <ExternalLink size={14} className="ms-1" />
                                    </a>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="gallery-lightbox-footer" onClick={(e) => e.stopPropagation()}>
                        <p className="text-white-50 small mb-0">
                            {activeVideo.album_title ? `Album: ${activeVideo.album_title}` : "ST Academy Video"}
                        </p>
                    </div>
                </div>
            )}
        </section>
    );
}
