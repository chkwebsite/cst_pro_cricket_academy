"use client";

import { useState } from "react";
import Link from "next/link";

export default function GallerySection({
  tag = "Our Galleries",
  title = "Moments from the Field",
  categories = [
    { id: "matches", label: "Matches" },
    { id: "tournament", label: "Tournament" },
    { id: "events", label: "Events" },
  ],
  galleryData = {
    matches: [
      {
        title: "Day-Night Match",
        image: "/images/website/scene-night.svg",
        category: "Matches",
      },
      {
        title: "Match-Winning Catch",
        image: "/images/website/scene-catch.svg",
        category: "Matches",
      },
      {
        title: "Opening Partnership",
        image: "/images/website/scene-batting.svg",
        category: "Matches",
      },
      {
        title: "Chasing 186",
        image: "/images/website/scene-scoreboard.svg",
        category: "Matches",
      },
    ],
    tournament: [
      {
        title: "Champions Trophy",
        image: "/images/website/scene-trophy.svg",
        category: "Tournament",
      },
      {
        title: "Semi-Final Clean Bowled",
        image: "/images/website/scene-stumps.svg",
        category: "Tournament",
      },
      {
        title: "Squad Photo",
        image: "/images/website/scene-team.svg",
        category: "Tournament",
      },
      {
        title: "Final Over Thriller",
        image: "/images/website/scene-bowling.svg",
        category: "Tournament",
      },
    ],
    events: [
      {
        title: "Residential Camp",
        image: "/images/website/scene-hostel.svg",
        category: "Events",
      },
      {
        title: "Fitness Day",
        image: "/images/website/scene-fitness.svg",
        category: "Events",
      },
      {
        title: "Kit Distribution",
        image: "/images/website/scene-helmet.svg",
        category: "Events",
      },
      {
        title: "Annual Day",
        image: "/images/website/scene-team.svg",
        category: "Events",
      },
    ],
  },
}) {
  const [activeTab, setActiveTab] = useState("matches");

  const currentItems = galleryData[activeTab] || [];

  return (
    <section id="gallery">
      <div className="container">
        <div className="text-center mb-4 reveal">
          <span className="section-tag">{tag}</span>
          <h2 className="section-title">{title}</h2>
          <div className="divider"></div>
        </div>

        {/* Tab Buttons */}
        <ul
          className="nav nav-pills gallery-tabs justify-content-center mb-5 reveal"
          role="tablist"
        >
          {categories.map((cat) => (
            <li className="nav-item" role="presentation" key={cat.id}>
              <button
                className={`nav-link ${activeTab === cat.id ? "active" : ""}`}
                type="button"
                role="tab"
                aria-selected={activeTab === cat.id}
                onClick={() => setActiveTab(cat.id)}
              >
                {cat.label}
              </button>
            </li>
          ))}
        </ul>

        {/* Tab Items */}
        <div className="tab-content">
          <div className="tab-pane fade show active">
            <div className="row g-3 g-lg-4">
              {currentItems.map((item, idx) => (
                <div className="col-6 col-lg-3" key={idx}>
                  <div className="gallery-item">
                    <img src={item.image} alt={item.title} loading="lazy" />
                    <span>
                      {item.title}
                      <small>{item.category}</small>
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="text-center mt-5">
              <Link
                href={`/gallery#${activeTab}`}
                className="btn btn-red btn-lg"
              >
                View More <i className="bi bi-arrow-right ms-1"></i>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
