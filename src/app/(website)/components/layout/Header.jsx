"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useUser } from "@/app/next_panel/components/UserContext";
import { useCart } from "../cart/CartContext";

function getDisplayName(user) {
  if (!user) return "User";
  if (user.name && user.name.trim()) return user.name.trim();
  const combined = [user.first_name, user.last_name].filter(Boolean).join(" ").trim();
  if (combined) return combined;
  if (user.appointment_no) return user.appointment_no;
  if (user.email) return user.email.split("@")[0];
  return "Account";
}

export default function Header({
  phone = "+91 8285831503",
  email = "chandankeshri100@gmail.com",
  logoSrc = "/images/website/logo.png",
  logoAlt = "CST Cricket Academy logo",
}) {
  const pathname = usePathname();
  const { user, isLoggedIn, logout } = useUser();
  const { itemCount, setDrawerOpen } = useCart();
  const [isSticky, setIsSticky] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [matchesDropdownOpen, setMatchesDropdownOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const userDropdownRef = useRef(null);

  const displayName = getDisplayName(user);

  // Close user dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (
        userDropdownRef.current &&
        !userDropdownRef.current.contains(event.target)
      ) {
        setUserDropdownOpen(false);
      }
    }
    if (userDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [userDropdownOpen]);

  // Robust single-click logout handler
  const handleLogout = async (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (loggingOut) return;
    setLoggingOut(true);
    setUserDropdownOpen(false);
    setNavOpen(false);
    try {
      await logout();
    } catch (err) {
      console.error("Logout failed:", err);
    } finally {
      window.location.href = "/";
    }
  };

  // Monitor scroll for fixed header on scroll
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 40) {
        setIsSticky(true);
      } else {
        setIsSticky(false);
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const [prevPathname, setPrevPathname] = useState(pathname);

  // Close menus on page navigation
  if (prevPathname !== pathname) {
    setPrevPathname(pathname);
    setNavOpen(false);
    setDropdownOpen(false);
    setMatchesDropdownOpen(false);
    setUserDropdownOpen(false);
  }

  const isActive = (path) => {
    if (path === "/" && pathname === "/") return true;
    if (path !== "/" && pathname.startsWith(path)) return true;
    return false;
  };

  const isAcademyActive = () => {
    return (
      pathname.startsWith("/about") ||
      pathname.startsWith("/facilities") ||
      pathname.startsWith("/achievements") ||
      pathname.startsWith("/coaches") ||
      pathname.startsWith("/programs") ||
      pathname.startsWith("/branches") ||
      pathname.startsWith("/rules")
    );
  };

  const isMatchesActive = () => {
    return (
      pathname.startsWith("/ground-booking") ||
      pathname.startsWith("/tournaments") ||
      pathname.startsWith("/matches") ||
      pathname.startsWith("/my-bookings") ||
      pathname.startsWith("/gallery")
    );
  };

  return (
    <>
      {/* Accessibility skip link */}
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>

      {/* Top Bar */}
      <div className="topbar">
        <div className="container d-flex flex-wrap justify-content-between align-items-center gap-2">
          <div>
            <i className="bi bi-telephone-fill me-1"></i>
            <a href={`tel:${phone.replace(/[^0-9+]/g, "")}`}>{phone}</a>
            <span className="mx-2 d-none d-sm-inline">|</span>
            <i className="bi bi-envelope-fill me-1"></i>
            <a href={`mailto:${email}`}>{email}</a>
          </div>
          <div className="d-none d-md-flex align-items-center gap-2">
            <Link href="/contact">Admissions</Link>
            <span>•</span>
            <Link href="/book-free-trial">Book a Free Trial</Link>
            <span>•</span>
            <Link href="/contact">Contact Us</Link>
            <span>•</span>
            {isLoggedIn && user ? (
              <div className="d-inline-flex align-items-center gap-2">
                <span className="text-white small fw-semibold">
                  <i className="bi bi-person-fill text-lime me-1"></i>
                  {displayName}
                </span>
                <span className="badge bg-lime text-navy" style={{ fontSize: "0.68rem" }}>
                  {user.user_type || "Public User"}
                </span>
                <button
                  type="button"
                  onClick={handleLogout}
                  disabled={loggingOut}
                  className="btn btn-link text-white-50 p-0 text-decoration-none small hover-white"
                  title="Logout"
                >
                  {loggingOut ? (
                    <span
                      className="spinner-border spinner-border-sm text-white"
                      role="status"
                      style={{ width: "12px", height: "12px" }}
                    ></span>
                  ) : (
                    <i className="bi bi-box-arrow-right text-white"></i>
                  )}
                </button>
              </div>
            ) : (
              <Link href="/login" className="fw-semibold text-lime">
                <i className="bi bi-box-arrow-in-right me-1"></i>Login
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Main Navigation (Fixed on page scroll) */}
      <div className={`header-nav-placeholder ${isSticky ? "is-sticky" : ""}`}>
        <nav
          className={`navbar navbar-expand-lg ${
            isSticky ? "is-sticky fixed-top" : "sticky-top"
          }`}
        >
        <div className="container">
          <Link
            className="navbar-brand d-flex align-items-center gap-2"
            href="/"
            onClick={() => setNavOpen(false)}
          >
            <img src={logoSrc} alt={logoAlt} />
          </Link>

          <button
            className="navbar-toggler"
            type="button"
            aria-controls="mainNav"
            aria-expanded={navOpen}
            aria-label="Toggle navigation"
            onClick={() => setNavOpen((prev) => !prev)}
          >
            <span className="navbar-toggler-icon"></span>
          </button>

          <div
            className={`collapse navbar-collapse ${navOpen ? "show" : ""}`}
            id="mainNav"
          >
            <ul className="navbar-nav ms-auto align-items-lg-center">
              <li className="nav-item">
                <Link
                  className={`nav-link ${isActive("/") ? "active" : ""}`}
                  href="/"
                  onClick={() => setNavOpen(false)}
                >
                  Home
                </Link>
              </li>

              {/* Dropdown 1: Academy Corners */}
              <li
                className={`nav-item dropdown ${
                  dropdownOpen ? "show" : ""
                }`}
                onMouseEnter={() => {
                  if (typeof window !== "undefined" && window.innerWidth >= 992) {
                    setDropdownOpen(true);
                  }
                }}
                onMouseLeave={() => {
                  if (typeof window !== "undefined" && window.innerWidth >= 992) {
                    setDropdownOpen(false);
                  }
                }}
              >
                <a
                  className={`nav-link dropdown-toggle ${
                    isAcademyActive() ? "active" : ""
                  }`}
                  href="#"
                  id="academyMenu"
                  role="button"
                  aria-expanded={dropdownOpen}
                  onClick={(e) => {
                    e.preventDefault();
                    setDropdownOpen((prev) => !prev);
                    setMatchesDropdownOpen(false);
                  }}
                >
                  Academy Corners
                </a>
                <ul
                  className={`dropdown-menu ${dropdownOpen ? "show" : ""}`}
                  aria-labelledby="academyMenu"
                >
                  <li>
                    <Link
                      className={`dropdown-item ${
                        isActive("/about") ? "active" : ""
                      }`}
                      href="/about"
                      onClick={() => setNavOpen(false)}
                    >
                      About Us
                    </Link>
                  </li>
                  <li>
                    <Link
                      className={`dropdown-item ${
                        isActive("/facilities") ? "active" : ""
                      }`}
                      href="/facilities"
                      onClick={() => setNavOpen(false)}
                    >
                      Facilities &amp; Campus
                    </Link>
                  </li>
                  <li>
                    <Link
                      className={`dropdown-item ${
                        isActive("/achievements") ? "active" : ""
                      }`}
                      href="/achievements"
                      onClick={() => setNavOpen(false)}
                    >
                      Hall of Fame &amp; Stars
                    </Link>
                  </li>
                  <li>
                    <Link
                      className={`dropdown-item ${
                        isActive("/coaches") ? "active" : ""
                      }`}
                      href="/coaches"
                      onClick={() => setNavOpen(false)}
                    >
                      Coach Corners
                    </Link>
                  </li>
                  <li>
                    <Link
                      className={`dropdown-item ${
                        isActive("/programs") ? "active" : ""
                      }`}
                      href="/programs"
                      onClick={() => setNavOpen(false)}
                    >
                      Our Programs
                    </Link>
                  </li>
                  <li>
                    <Link
                      className={`dropdown-item ${
                        isActive("/branches") ? "active" : ""
                      }`}
                      href="/branches"
                      onClick={() => setNavOpen(false)}
                    >
                      Our Branches
                    </Link>
                  </li>
                  <li>
                    <Link
                      className={`dropdown-item ${
                        isActive("/rules") ? "active" : ""
                      }`}
                      href="/rules"
                      onClick={() => setNavOpen(false)}
                    >
                      Rules &amp; Regulations
                    </Link>
                  </li>
                </ul>
              </li>

              {/* Dropdown 2: Matches & Events */}
              <li
                className={`nav-item dropdown ${
                  matchesDropdownOpen ? "show" : ""
                }`}
                onMouseEnter={() => {
                  if (typeof window !== "undefined" && window.innerWidth >= 992) {
                    setMatchesDropdownOpen(true);
                  }
                }}
                onMouseLeave={() => {
                  if (typeof window !== "undefined" && window.innerWidth >= 992) {
                    setMatchesDropdownOpen(false);
                  }
                }}
              >
                <a
                  className={`nav-link dropdown-toggle ${
                    isMatchesActive() ? "active" : ""
                  }`}
                  href="#"
                  id="matchesMenu"
                  role="button"
                  aria-expanded={matchesDropdownOpen}
                  onClick={(e) => {
                    e.preventDefault();
                    setMatchesDropdownOpen((prev) => !prev);
                    setDropdownOpen(false);
                  }}
                >
                  Matches &amp; Events
                </a>
                <ul
                  className={`dropdown-menu ${matchesDropdownOpen ? "show" : ""}`}
                  aria-labelledby="matchesMenu"
                >
                  <li>
                    <Link
                      className={`dropdown-item ${
                        isActive("/ground-booking") ? "active" : ""
                      }`}
                      href="/ground-booking"
                      onClick={() => setNavOpen(false)}
                    >
                      Ground Booking
                    </Link>
                  </li>
                  <li>
                    <Link
                      className={`dropdown-item ${
                        isActive("/tournaments") ? "active" : ""
                      }`}
                      href="/tournaments"
                      onClick={() => setNavOpen(false)}
                    >
                      Tournaments &amp; Cups
                    </Link>
                  </li>
                  <li>
                    <Link
                      className={`dropdown-item ${
                        isActive("/matches") ? "active" : ""
                      }`}
                      href="/matches"
                      onClick={() => setNavOpen(false)}
                    >
                      Live Matches &amp; Fixtures
                    </Link>
                  </li>
                  <li>
                    <Link
                      className={`dropdown-item ${
                        isActive("/my-bookings") ? "active" : ""
                      }`}
                      href="/my-bookings"
                      onClick={() => setNavOpen(false)}
                    >
                      My Slot Bookings
                    </Link>
                  </li>
                  <li>
                    <Link
                      className={`dropdown-item ${
                        isActive("/gallery") ? "active" : ""
                      }`}
                      href="/gallery"
                      onClick={() => setNavOpen(false)}
                    >
                      Photo Gallery
                    </Link>
                  </li>
                </ul>
              </li>

              {/* Mobile only Contact Us */}
              <li className="nav-item d-lg-none">
                <Link
                  className={`nav-link ${
                    isActive("/contact") ? "active" : ""
                  }`}
                  href="/contact"
                  onClick={() => setNavOpen(false)}
                >
                  Contact Us
                </Link>
              </li>

              {/* Store / Pro Shop */}
              <li className="nav-item">
                <Link
                  className={`nav-link ${
                    isActive("/shop") ? "active" : ""
                  }`}
                  href="/shop"
                  onClick={() => setNavOpen(false)}
                >
                  <i className="bi bi-shop me-1 text-lime"></i>
                  Store
                </Link>
              </li>

              {/* Shopping Cart Button (Visible only when logged in) */}
              {isLoggedIn && user && (
                <li className="nav-item d-flex align-items-center">
                  <button
                    type="button"
                    className="btn btn-link text-white p-2 position-relative text-decoration-none d-flex align-items-center"
                    onClick={() => {
                      setNavOpen(false);
                      setDrawerOpen(true);
                    }}
                    title="Shopping Cart"
                    aria-label="View Shopping Cart"
                  >
                    <i className="bi bi-cart3 fs-5" style={{ color: "var(--lime)" }}></i>
                    {itemCount > 0 && (
                      <span
                        className="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger"
                        style={{ fontSize: "0.68rem" }}
                      >
                        {itemCount}
                      </span>
                    )}
                  </button>
                </li>
              )}

              {isLoggedIn && user ? (
                <li
                  className="nav-item dropdown user-nav-dropdown ms-lg-2"
                  ref={userDropdownRef}
                >
                  <button
                    className={`btn btn-sm rounded-pill px-3 py-1.5 d-flex align-items-center gap-2 user-menu-btn text-white ${
                      userDropdownOpen ? "active-dropdown" : ""
                    }`}
                    type="button"
                    id="userAccountMenu"
                    aria-expanded={userDropdownOpen}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setUserDropdownOpen((prev) => !prev);
                    }}
                  >
                    <span
                      className="user-avatar-circle"
                      style={{ width: "28px", height: "28px", fontSize: "0.8rem" }}
                    >
                      {user.profile_image ? (
                        <img
                          src={user.profile_image}
                          alt={displayName}
                          className="w-100 h-100 rounded-circle object-fit-cover"
                        />
                      ) : (
                        (displayName?.[0] || "U").toUpperCase()
                      )}
                    </span>
                    <span
                      className="fw-bold text-white text-truncate"
                      style={{ maxWidth: "120px" }}
                    >
                      {displayName}
                    </span>
                    <i
                      className="bi bi-chevron-down text-white-50"
                      style={{
                        fontSize: "0.75rem",
                        transform: userDropdownOpen ? "rotate(180deg)" : "rotate(0deg)",
                        transition: "transform 0.2s ease",
                      }}
                    ></i>
                  </button>

                  <div
                    className={`dropdown-menu dropdown-menu-end user-account-dropdown-menu ${
                      userDropdownOpen ? "show" : ""
                    }`}
                    style={{ right: 0, left: "auto" }}
                    aria-labelledby="userAccountMenu"
                  >
                    {/* Header info */}
                    <div className="user-card-header">
                      <div className="d-flex align-items-center gap-2">
                        <div className="user-avatar-circle">
                          {user.profile_image ? (
                            <img
                              src={user.profile_image}
                              alt={displayName}
                              className="w-100 h-100 rounded-circle object-fit-cover"
                            />
                          ) : (
                            (displayName?.[0] || "U").toUpperCase()
                          )}
                        </div>
                        <div className="overflow-hidden flex-grow-1">
                          <div
                            className="fw-bold text-dark text-truncate"
                            style={{ fontSize: "0.95rem" }}
                            title={displayName}
                          >
                            {displayName}
                          </div>
                          <span
                            className="badge mt-0.5"
                            style={{
                              background: user.is_public ? "#0284c7" : "var(--navy)",
                              color: user.is_public ? "#ffffff" : "var(--lime)",
                              fontSize: "0.68rem",
                              fontWeight: 600,
                              padding: "0.2rem 0.55rem",
                              borderRadius: "50px",
                            }}
                          >
                            {user.user_type || (user.is_public ? "Public User" : "Academy User")}
                          </span>
                        </div>
                      </div>

                      {(user.email || user.phone) && (
                        <div className="mt-2 pt-2 border-top" style={{ borderColor: "#e2e8f0" }}>
                          {user.email && (
                            <div
                              className="text-muted small text-truncate d-flex align-items-center gap-1"
                              style={{ fontSize: "0.76rem" }}
                              title={user.email}
                            >
                              <i className="bi bi-envelope text-secondary"></i>
                              <span className="text-truncate">{user.email}</span>
                            </div>
                          )}
                          {user.phone && (
                            <div
                              className="text-muted small text-truncate d-flex align-items-center gap-1 mt-1"
                              style={{ fontSize: "0.76rem" }}
                            >
                              <i className="bi bi-telephone text-secondary"></i>
                              <span>{user.phone}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Menu links */}
                    <div className="d-flex flex-column gap-1">
                      {/* 1. User Profile */}
                      <Link
                        className="dropdown-item"
                        href="/profile"
                        onClick={() => {
                          setNavOpen(false);
                          setUserDropdownOpen(false);
                        }}
                      >
                        <span className="item-icon-box" style={{ background: "#eff6ff", color: "#2563eb" }}>
                          <i className="bi bi-person-circle"></i>
                        </span>
                        <div className="flex-grow-1">
                          <div className="fw-semibold text-dark" style={{ lineHeight: 1.2 }}>User Profile</div>
                          <div className="text-muted" style={{ fontSize: "0.72rem" }}>Profile settings & info</div>
                        </div>
                        <i className="bi bi-chevron-right text-muted small opacity-50"></i>
                      </Link>

                      {/* 2. User Orders */}
                      <Link
                        className="dropdown-item"
                        href="/orders"
                        onClick={() => {
                          setNavOpen(false);
                          setUserDropdownOpen(false);
                        }}
                      >
                        <span className="item-icon-box" style={{ background: "#ecfdf5", color: "#059669" }}>
                          <i className="bi bi-bag-check-fill"></i>
                        </span>
                        <div className="flex-grow-1">
                          <div className="fw-semibold text-dark" style={{ lineHeight: 1.2 }}>User Orders</div>
                          <div className="text-muted" style={{ fontSize: "0.72rem" }}>Track store purchases</div>
                        </div>
                        <i className="bi bi-chevron-right text-muted small opacity-50"></i>
                      </Link>

                      {/* 3. My Ground Bookings */}
                      <Link
                        className="dropdown-item"
                        href="/my-bookings"
                        onClick={() => {
                          setNavOpen(false);
                          setUserDropdownOpen(false);
                        }}
                      >
                        <span className="item-icon-box" style={{ background: "#fef3c7", color: "#d97706" }}>
                          <i className="bi bi-calendar-check-fill"></i>
                        </span>
                        <div className="flex-grow-1">
                          <div className="fw-semibold text-dark" style={{ lineHeight: 1.2 }}>Ground Bookings</div>
                          <div className="text-muted" style={{ fontSize: "0.72rem" }}>Reserved turf match slots</div>
                        </div>
                        <i className="bi bi-chevron-right text-muted small opacity-50"></i>
                      </Link>

                      {/* Admin Portal link if academy user */}
                      {!user.is_public && user.user_type !== "Public User" && (
                        <Link
                          className="dropdown-item"
                          href="/next_panel/dashboard"
                          onClick={() => {
                            setNavOpen(false);
                            setUserDropdownOpen(false);
                          }}
                        >
                          <span className="item-icon-box" style={{ background: "#fff1f2", color: "#e11d48" }}>
                            <i className="bi bi-speedometer2"></i>
                          </span>
                          <div className="flex-grow-1">
                            <div className="fw-semibold text-dark" style={{ lineHeight: 1.2 }}>Academy Portal</div>
                            <div className="text-muted" style={{ fontSize: "0.72rem" }}>Manage academy dashboard</div>
                          </div>
                          <span
                            className="badge bg-danger-subtle text-danger border border-danger-subtle"
                            style={{ fontSize: "0.65rem", padding: "0.2rem 0.45rem" }}
                          >
                            Portal
                          </span>
                        </Link>
                      )}

                      <hr className="dropdown-divider" />

                      {/* 3. Logout */}
                      <button
                        type="button"
                        className="dropdown-item dropdown-item-danger border-0 w-100 text-start"
                        onClick={handleLogout}
                        disabled={loggingOut}
                      >
                        <span className="item-icon-box" style={{ background: "#fef2f2", color: "#dc2626" }}>
                          {loggingOut ? (
                            <span
                              className="spinner-border spinner-border-sm"
                              role="status"
                              style={{ width: "13px", height: "13px" }}
                            ></span>
                          ) : (
                            <i className="bi bi-box-arrow-right"></i>
                          )}
                        </span>
                        <div className="flex-grow-1">
                          <div className="fw-semibold text-danger" style={{ lineHeight: 1.2 }}>
                            {loggingOut ? "Signing out..." : "Sign Out"}
                          </div>
                          <div className="text-muted" style={{ fontSize: "0.72rem" }}>Log out from this account</div>
                        </div>
                      </button>
                    </div>
                  </div>
                </li>
              ) : (
                <li className="nav-item">
                  <Link
                    className={`nav-link ${
                      isActive("/login") ? "active" : ""
                    }`}
                    href="/login"
                    onClick={() => setNavOpen(false)}
                  >
                    <i className="bi bi-person-circle me-1"></i>Login
                  </Link>
                </li>
              )}
            </ul>
          </div>
        </div>
      </nav>
    </div>
  </>
  );
}
