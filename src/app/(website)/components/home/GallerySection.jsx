"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";

const CATEGORIES = [
  { id: "matches", label: "Matches" },
  { id: "tournament", label: "Tournament" },
  { id: "events", label: "Events" },
];

const DEFAULT_GALLERY = {
  matches: [
    {
      id: "m-1",
      title: "DAY-NIGHT MATCH",
      cat: "MATCHES",
      album: "Floodlight Cricket League",
      img: "/images/website/scene-night.svg",
      caption: "Center pitch match under 800-lux high-intensity floodlights.",
    },
    {
      id: "m-2",
      title: "MATCH-WINNING CATCH",
      cat: "MATCHES",
      album: "Inter-Academy League",
      img: "/images/website/scene-catch.svg",
      caption: "Spectacular diving catch behind the stumps during death overs.",
    },
    {
      id: "m-3",
      title: "OPENING PARTNERSHIP",
      cat: "MATCHES",
      album: "Premier League Derby",
      img: "/images/website/scene-batting.svg",
      caption: "Match-defining opening stand and classic strokeplay.",
    },
    {
      id: "m-4",
      title: "CHASING 186",
      cat: "MATCHES",
      album: "Apex Trophy Final",
      img: "/images/website/scene-scoreboard.svg",
      caption: "Apex XI 186/4 final-over championship chase.",
    },
  ],
  tournament: [
    {
      id: "t-1",
      title: "CHAMPIONS TROPHY",
      cat: "TOURNAMENT",
      album: "State Level Cup",
      img: "/images/website/scene-trophy.svg",
      caption: "Gold medal and championship trophy presentation ceremony.",
    },
    {
      id: "t-2",
      title: "SEMI-FINAL CLEAN BOWLED",
      cat: "TOURNAMENT",
      album: "Junior Inter-District Cup",
      img: "/images/website/scene-stumps.svg",
      caption: "Fierce pace delivery shattering middle and off stump.",
    },
    {
      id: "t-3",
      title: "SQUAD CELEBRATION",
      cat: "TOURNAMENT",
      album: "Annual Academy Championship",
      img: "/images/website/scene-team.svg",
      caption: "State championship squad celebrating the tournament title.",
    },
    {
      id: "t-4",
      title: "FINAL OVER THRILLER",
      cat: "TOURNAMENT",
      album: "Under-19 Gold Cup",
      img: "/images/website/scene-bowling.svg",
      caption: "Fast bowling yorker under pressure in the final over.",
    },
  ],
  events: [
    {
      id: "e-1",
      title: "RESIDENTIAL CAMP",
      cat: "EVENTS",
      album: "Summer Intensive Camp",
      img: "/images/website/scene-hostel.svg",
      caption: "Full-day cricket immersion, stamina building, and hostel life.",
    },
    {
      id: "e-2",
      title: "FITNESS & AGILITY DAY",
      cat: "EVENTS",
      album: "Academy Sports Day",
      img: "/images/website/scene-fitness.svg",
      caption: "Endurance sprint challenges, agility ladder drills, and speed testing.",
    },
    {
      id: "e-3",
      title: "KIT DISTRIBUTION",
      cat: "EVENTS",
      album: "New Season Induction",
      img: "/images/website/scene-helmet.svg",
      caption: "Professional protective cricket gear and academy jersey distribution.",
    },
    {
      id: "e-4",
      title: "ANNUAL DAY CEREMONY",
      cat: "EVENTS",
      album: "Annual Felicitation 2026",
      img: "/images/website/scene-team.svg",
      caption: "Annual felicitation of top run-scorers and leading wicket-takers.",
    },
  ],
};

export default function GallerySection({
  tag = "OUR GALLERIES",
  title = "MOMENTS FROM THE FIELD",
}) {
  const [activeTab, setActiveTab] = useState("matches");
  const [dbItemsByCat, setDbItemsByCat] = useState({});
  const [lightboxIndex, setLightboxIndex] = useState(null);

  useEffect(() => {
    let isMounted = true;
    async function loadApiImages() {
      try {
        const res = await fetch("/api/gallery-images?status=1");
        if (!res.ok) return;
        const json = await res.json();
        const rawList = Array.isArray(json?.data)
          ? json.data
          : Array.isArray(json?.images)
          ? json.images
          : Array.isArray(json)
          ? json
          : [];

        if (isMounted && rawList.length > 0) {
          const grouped = { matches: [], tournament: [], events: [] };
          rawList.forEach((img, idx) => {
            const rawCat = (img.category_name || img.category_slug || "").toLowerCase();
            let bucket = "matches";
            if (rawCat.includes("tourn")) bucket = "tournament";
            else if (rawCat.includes("event") || rawCat.includes("camp")) bucket = "events";

            grouped[bucket].push({
              id: img.id || `api-${idx}`,
              title: (img.image_caption || img.title || `Moment ${idx + 1}`).toUpperCase(),
              cat: bucket.toUpperCase(),
              album: img.album_title || "CST Highlights",
              img: img.image_path || img.image_url || img.url,
              caption: img.alt_text || img.description || "CST Cricket Academy highlights.",
            });
          });
          setDbItemsByCat(grouped);
        }
      } catch (e) {
        // Graceful fallback to DEFAULT_GALLERY
      }
    }
    loadApiImages();
    return () => {
      isMounted = false;
    };
  }, []);

  // Display items for current tab: prioritize DB items (max 8) or fallback to 4 default cards
  const displayItems = useMemo(() => {
    const fromDb = dbItemsByCat[activeTab];
    if (fromDb && fromDb.length > 0) {
      return fromDb.slice(0, 8);
    }
    return DEFAULT_GALLERY[activeTab] || DEFAULT_GALLERY.matches;
  }, [activeTab, dbItemsByCat]);

  // Lightbox keyboard navigation & body scroll lock
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (lightboxIndex === null) return;
      if (e.key === "Escape") setLightboxIndex(null);
      if (e.key === "ArrowLeft") {
        setLightboxIndex(
          (prev) => (prev - 1 + displayItems.length) % displayItems.length
        );
      }
      if (e.key === "ArrowRight") {
        setLightboxIndex((prev) => (prev + 1) % displayItems.length);
      }
    };

    if (lightboxIndex !== null) {
      document.body.style.overflow = "hidden";
      window.addEventListener("keydown", handleKeyDown);
    } else {
      document.body.style.overflow = "";
    }

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [lightboxIndex, displayItems.length]);

  const activePhoto =
    lightboxIndex !== null ? displayItems[lightboxIndex] : null;

  return (
    <section
      className="section"
      id="gallery"
      style={{
        position: "relative",
        overflow: "hidden",
        background: "#f8fafc",
        padding: "85px 0 95px",
      }}
    >
      {/* Floating Bubble Wave Animation (10-15% Opacity on Light Background) */}
      <div className="bubble-wave-container" aria-hidden="true">
        <span className="bubble-wave-item b1"></span>
        <span className="bubble-wave-item b2"></span>
        <span className="bubble-wave-item b3"></span>
        <span className="bubble-wave-item b4"></span>
        <span className="bubble-wave-item b5"></span>
        <span className="bubble-wave-item b6"></span>
        <span className="bubble-wave-item b7"></span>
        <span className="bubble-wave-item b8"></span>
        <span className="bubble-wave-item b9"></span>
        <span className="bubble-wave-item b10"></span>
      </div>

      <div className="container" style={{ position: "relative", zIndex: 2 }}>
        {/* Section Header */}
        <div
          className="section-head text-center"
          data-reveal
          style={{ textAlign: "center", marginBottom: "32px" }}
        >
          <span className="gallery-eyebrow-pill">{tag}</span>
          <h2 className="gallery-title">{title}</h2>
          <div className="gallery-divider" aria-hidden="true"></div>
        </div>

        {/* Category Filter Tabs */}
        <div
          className="gallery-tabs-row"
          role="group"
          aria-label="Gallery category filters"
        >
          {CATEGORIES.map((cat) => {
            const isActive = activeTab === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                className={`gallery-tab-btn ${isActive ? "is-active" : ""}`}
                onClick={() => {
                  setActiveTab(cat.id);
                  setLightboxIndex(null);
                }}
                aria-pressed={isActive}
              >
                {cat.label}
              </button>
            );
          })}
        </div>

        {/* 4-Column Responsive Grid */}
        <div className="gallery-grid--4" data-reveal>
          {displayItems.map((item, idx) => (
            <div
              key={item.id || idx}
              className="gallery-shot-card"
              onClick={() => setLightboxIndex(idx)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setLightboxIndex(idx);
                }
              }}
              aria-label={`View photo: ${item.title}`}
            >
              <img
                src={item.img}
                alt={item.title}
                loading="lazy"
                width={600}
                height={450}
              />
              <div className="gallery-shot-overlay">
                <h4 className="gallery-shot-title">{item.title}</h4>
                <p className="gallery-shot-category">{item.cat}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Bottom View More Button */}
        <div style={{ textAlign: "center", marginTop: "44px" }} data-reveal>
          <Link
            className="gallery-view-more-btn"
            href={`/gallery#${activeTab}`}
          >
            View More &rarr;
          </Link>
        </div>
      </div>

      {/* Lightbox Modal */}
      {lightboxIndex !== null && activePhoto && (
        <div
          className="lightbox is-open"
          role="dialog"
          aria-modal="true"
          aria-label="Image viewer"
          onClick={() => setLightboxIndex(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(7, 30, 38, 0.94)",
            zIndex: 10000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
          }}
        >
          {/* Close button */}
          <button
            type="button"
            className="lb-close"
            aria-label="Close"
            onClick={(e) => {
              e.stopPropagation();
              setLightboxIndex(null);
            }}
            style={{
              position: "absolute",
              top: "24px",
              right: "24px",
              background: "rgba(255, 255, 255, 0.15)",
              border: 0,
              color: "#fff",
              width: "44px",
              height: "44px",
              borderRadius: "50%",
              fontSize: "28px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            &times;
          </button>

          {/* Previous button */}
          <button
            type="button"
            className="lb-prev"
            aria-label="Previous image"
            onClick={(e) => {
              e.stopPropagation();
              setLightboxIndex(
                (prev) => (prev - 1 + displayItems.length) % displayItems.length
              );
            }}
            style={{
              position: "absolute",
              left: "24px",
              top: "50%",
              transform: "translateY(-50%)",
              background: "rgba(255, 255, 255, 0.15)",
              border: 0,
              color: "#fff",
              width: "48px",
              height: "48px",
              borderRadius: "50%",
              fontSize: "30px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            &#8249;
          </button>

          {/* Photo container */}
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: "960px",
              width: "100%",
              textAlign: "center",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
            }}
          >
            <div
              style={{
                borderRadius: "16px",
                overflow: "hidden",
                maxHeight: "75vh",
                boxShadow: "0 25px 60px rgba(0, 0, 0, 0.5)",
                background: "var(--navy)",
              }}
            >
              <img
                src={activePhoto.img}
                alt={activePhoto.title}
                style={{
                  maxWidth: "100%",
                  maxHeight: "75vh",
                  objectFit: "contain",
                  display: "block",
                }}
              />
            </div>

            <div
              style={{
                marginTop: "16px",
                color: "#fff",
                maxWidth: "600px",
              }}
            >
              <h3
                style={{
                  fontSize: "18px",
                  fontWeight: 700,
                  margin: "0 0 4px 0",
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                }}
              >
                {activePhoto.title}
              </h3>
              <p
                style={{
                  fontSize: "14px",
                  color: "rgba(255, 255, 255, 0.75)",
                  margin: 0,
                }}
              >
                {activePhoto.caption || activePhoto.album} &middot; Photo{" "}
                {lightboxIndex + 1} of {displayItems.length}
              </p>
            </div>
          </div>

          {/* Next button */}
          <button
            type="button"
            className="lb-next"
            aria-label="Next image"
            onClick={(e) => {
              e.stopPropagation();
              setLightboxIndex((prev) => (prev + 1) % displayItems.length);
            }}
            style={{
              position: "absolute",
              right: "24px",
              top: "50%",
              transform: "translateY(-50%)",
              background: "rgba(255, 255, 255, 0.15)",
              border: 0,
              color: "#fff",
              width: "48px",
              height: "48px",
              borderRadius: "50%",
              fontSize: "30px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            &#8250;
          </button>
        </div>
      )}
    </section>
  );
}
