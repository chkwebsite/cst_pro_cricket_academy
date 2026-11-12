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
}) {
  const pathname = usePathname();
  const { user, isLoggedIn, logout } = useUser();
  const { itemCount, setDrawerOpen } = useCart();
  const [isSticky, setIsSticky] = useState(false);
  const [headerHeight, setHeaderHeight] = useState(72);
  const [navOpen, setNavOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [openMobileSubmenu, setOpenMobileSubmenu] = useState(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const userDropdownRef = useRef(null);
  const headerRef = useRef(null);

  const displayName = getDisplayName(user);

  // Close user dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (userDropdownRef.current && !userDropdownRef.current.contains(event.target)) {
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

  // Monitor scroll for fixed sticky header and measure height
  useEffect(() => {
    const updateHeight = () => {
      if (headerRef.current) {
        setHeaderHeight(headerRef.current.offsetHeight || 72);
      }
    };
    updateHeight();

    const handleScroll = () => {
      setIsSticky(window.scrollY > 30);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", updateHeight, { passive: true });
    handleScroll();

    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", updateHeight);
    };
  }, []);

  const [prevPath, setPrevPath] = useState(pathname);
  if (prevPath !== pathname) {
    setPrevPath(pathname);
    setNavOpen(false);
    setUserDropdownOpen(false);
    setOpenMobileSubmenu(null);
  }

  const closeNav = () => {
    setNavOpen(false);
    setOpenMobileSubmenu(null);
  };

  const toggleMobileSubmenu = (menu) => {
    setOpenMobileSubmenu((prev) => (prev === menu ? null : menu));
  };

  const handleLogout = async (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (loggingOut) return;
    setLoggingOut(true);
    setUserDropdownOpen(false);
    closeNav();
    try {
      await logout();
    } catch (err) {
      console.error("Logout failed:", err);
    } finally {
      window.location.href = "/";
    }
  };

  const isAcademyActive =
    pathname.startsWith("/about") ||
    pathname.startsWith("/facilities") ||
    pathname.startsWith("/achievements") ||
    pathname.startsWith("/coaches");

  const isMatchesActive =
    pathname.startsWith("/matches") ||
    pathname.startsWith("/tournaments") ||
    pathname.startsWith("/ground-booking") ||
    pathname.startsWith("/my-bookings");

  return (
    <>
      <a className="sr-only" href="#main-content">
        Skip to content
      </a>

      {/* Top Bar */}
      <div className="topbar">
        <div className="container">
          <div className="topbar__group">
            <a href={`tel:${phone.replace(/[^0-9+]/g, "")}`}>{phone}</a>
            <a href={`mailto:${email}`}>{email}</a>
          </div>
          <div className="topbar__group">
            <Link href="/contact">Admissions</Link>
            <Link href="/book-free-trial">Book a Free Trial</Link>
            <Link href="/contact">Contact Us</Link>
          </div>
        </div>
      </div>

      {/* Main Sticky/Fixed Header Wrapper */}
      <div
        className="header-wrapper"
        style={{
          minHeight: isSticky ? `${headerHeight}px` : "auto",
        }}
      >
        <header
          ref={headerRef}
          className={`header ${isSticky ? "is-stuck" : ""}`}
        >
        <div className="container header__inner">
          <Link className="logo" href="/" aria-label="CST Cricket Academy home">
            <img
              src="/images/website/CSTCricketAcademyLogo.png"
              alt="CST Cricket Academy"
              className="logo__img"
              width={180}
              height={46}
              priority="true"
            />
          </Link>

          {/* Desktop Navigation */}
          <ul className="nav" aria-label="Main navigation">
            <li>
              <Link href="/" className={pathname === "/" ? "is-active" : ""}>
                Home
              </Link>
            </li>
            <li className={isAcademyActive ? "is-active" : ""}>
              <button aria-haspopup="true">
                Academy{" "}
                <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="m2 4 4 4 4-4" />
                </svg>
              </button>
              <div className="dropdown">
                <Link href="/about">About Us</Link>
                <Link href="/facilities">Facilities &amp; Campus</Link>
                <Link href="/coaches">Coach Profiles</Link>
                <Link href="/achievements">Hall of Fame</Link>
              </div>
            </li>
            <li>
              <Link href="/programs" className={pathname.startsWith("/programs") ? "is-active" : ""}>
                Coaching
              </Link>
            </li>
            <li className={isMatchesActive ? "is-active" : ""}>
              <button aria-haspopup="true">
                Matches &amp; Events{" "}
                <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="m2 4 4 4 4-4" />
                </svg>
              </button>
              <div className="dropdown">
                <Link href="/matches">Live Matches &amp; Fixtures</Link>
                <Link href="/tournaments">Tournaments &amp; Cups</Link>
                <Link href="/ground-booking">Ground Booking</Link>
                <Link href="/my-bookings">My Slot Bookings</Link>
              </div>
            </li>
            <li>
              <Link href="/branches" className={pathname.startsWith("/branches") ? "is-active" : ""}>
                Branches
              </Link>
            </li>
            <li>
              <Link href="/gallery" className={pathname.startsWith("/gallery") ? "is-active" : ""}>
                Gallery
              </Link>
            </li>
            <li>
              <Link href="/shop" className={pathname.startsWith("/shop") ? "is-active" : ""}>
                Pro Store
              </Link>
            </li>
          </ul>

          {/* Header Actions / CTA */}
          <div className="header__cta">
            {/* Pro Store Cart Button (Only shown when user is logged in) */}
            {isLoggedIn && (
              <button
                type="button"
                className="btn btn--sm btn--outline position-relative"
                style={{ padding: "8px 14px", minWidth: "44px" }}
                onClick={() => setDrawerOpen(true)}
                aria-label="View Cart"
                title="View Shopping Cart"
              >
                <i className="bi bi-bag" style={{ fontSize: "1.1rem" }}></i>
                {itemCount > 0 && (
                  <span
                    style={{
                      position: "absolute",
                      top: "-4px",
                      right: "-4px",
                      background: "var(--red)",
                      color: "#fff",
                      borderRadius: "50%",
                      fontSize: "0.7rem",
                      fontWeight: 700,
                      width: "18px",
                      height: "18px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {itemCount}
                  </span>
                )}
              </button>
            )}

            {/* User Dropdown / Login */}
            {isLoggedIn ? (
              <div className="position-relative" ref={userDropdownRef}>
                <button
                  type="button"
                  className="btn btn--sm btn--navy d-flex align-items-center gap-2"
                  onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                  aria-expanded={userDropdownOpen}
                >
                  <i className="bi bi-person-circle"></i>
                  <span className="d-none d-md-inline text-truncate" style={{ maxWidth: "110px" }}>
                    {displayName}
                  </span>
                  <i className="bi bi-chevron-down" style={{ fontSize: "0.7rem" }}></i>
                </button>

                {userDropdownOpen && (
                  <div
                    style={{
                      position: "absolute",
                      top: "calc(100% + 8px)",
                      right: 0,
                      minWidth: "200px",
                      background: "#fff",
                      borderRadius: "18px",
                      padding: "10px",
                      boxShadow: "0 24px 48px -10px rgba(7,30,38,.35)",
                      border: "1px solid var(--line)",
                      zIndex: 1000,
                    }}
                  >
                    <div style={{ padding: "8px 14px", borderBottom: "1px solid var(--line)" }}>
                      <p style={{ fontWeight: 700, fontSize: "14px", margin: 0 }}>{displayName}</p>
                      <small style={{ color: "var(--muted)", fontSize: "12px" }}>{user?.email || "Signed In"}</small>
                    </div>
                    {user?.role && (
                      <Link
                        href="/next_panel"
                        className="dropdown-item"
                        style={{ display: "block", padding: "10px 14px", fontSize: "14px", color: "var(--navy)", fontWeight: 600 }}
                        onClick={() => setUserDropdownOpen(false)}
                      >
                        <i className="bi bi-speedometer2 me-2"></i>Admin Dashboard
                      </Link>
                    )}
                    <Link
                      href="/my-bookings"
                      className="dropdown-item"
                      style={{ display: "block", padding: "10px 14px", fontSize: "14px", color: "var(--navy)" }}
                      onClick={() => setUserDropdownOpen(false)}
                    >
                      <i className="bi bi-calendar-check me-2"></i>My Bookings
                    </Link>
                    <Link
                      href="/orders"
                      className="dropdown-item"
                      style={{ display: "block", padding: "10px 14px", fontSize: "14px", color: "var(--navy)" }}
                      onClick={() => setUserDropdownOpen(false)}
                    >
                      <i className="bi bi-receipt me-2"></i>My Orders
                    </Link>
                    <button
                      type="button"
                      className="dropdown-item text-danger border-0 bg-transparent w-100 text-start"
                      style={{ display: "block", padding: "10px 14px", fontSize: "14px", fontWeight: 600 }}
                      onClick={handleLogout}
                      disabled={loggingOut}
                    >
                      <i className="bi bi-box-arrow-right me-2"></i>
                      {loggingOut ? "Signing Out..." : "Sign Out"}
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <Link className="login btn btn--sm btn--outline" href="/login">
                Login
              </Link>
            )}

            {/* Mobile Hamburger Button */}
            <button
              className={`menu-btn ${navOpen ? "is-open" : ""}`}
              aria-label="Open menu"
              aria-expanded={navOpen}
              onClick={() => {
                if (navOpen) {
                  closeNav();
                } else {
                  setNavOpen(true);
                }
              }}
            >
              <span></span>
              <span></span>
              <span></span>
            </button>
          </div>
        </div>
        </header>
      </div>

      {/* Mobile Drawer & Scrim */}
      <div
        className={`scrim ${navOpen ? "is-open" : ""}`}
        onClick={closeNav}
        aria-hidden="true"
      ></div>

      <nav className={`mobile-nav ${navOpen ? "is-open" : ""}`} aria-label="Mobile navigation">
        <Link
          href="/"
          className={pathname === "/" ? "is-active" : ""}
          onClick={closeNav}
        >
          Home
        </Link>

        {/* Academy Submenu */}
        <div className="mobile-nav__group">
          <button
            type="button"
            className={`mobile-nav__toggle ${openMobileSubmenu === "academy" ? "is-open" : ""} ${isAcademyActive ? "is-active" : ""}`}
            onClick={() => toggleMobileSubmenu("academy")}
            aria-expanded={openMobileSubmenu === "academy"}
            aria-controls="mobile-sub-academy"
          >
            <span>Academy</span>
            <svg
              viewBox="0 0 12 12"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              className="mobile-nav__arrow"
            >
              <path d="m2 4 4 4 4-4" />
            </svg>
          </button>
          {openMobileSubmenu === "academy" && (
            <div id="mobile-sub-academy" className="mobile-nav__sub">
              <Link
                className={`sub ${pathname === "/about" ? "is-active" : ""}`}
                href="/about"
                onClick={closeNav}
              >
                About Us
              </Link>
              <Link
                className={`sub ${pathname === "/facilities" ? "is-active" : ""}`}
                href="/facilities"
                onClick={closeNav}
              >
                Facilities &amp; Campus
              </Link>
              <Link
                className={`sub ${pathname === "/coaches" ? "is-active" : ""}`}
                href="/coaches"
                onClick={closeNav}
              >
                Coach Profiles
              </Link>
              <Link
                className={`sub ${pathname === "/achievements" ? "is-active" : ""}`}
                href="/achievements"
                onClick={closeNav}
              >
                Hall of Fame
              </Link>
            </div>
          )}
        </div>

        <Link
          href="/programs"
          className={pathname.startsWith("/programs") ? "is-active" : ""}
          onClick={closeNav}
        >
          Coaching Programs
        </Link>

        {/* Matches & Events Submenu */}
        <div className="mobile-nav__group">
          <button
            type="button"
            className={`mobile-nav__toggle ${openMobileSubmenu === "matches" ? "is-open" : ""} ${isMatchesActive ? "is-active" : ""}`}
            onClick={() => toggleMobileSubmenu("matches")}
            aria-expanded={openMobileSubmenu === "matches"}
            aria-controls="mobile-sub-matches"
          >
            <span>Matches &amp; Events</span>
            <svg
              viewBox="0 0 12 12"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              className="mobile-nav__arrow"
            >
              <path d="m2 4 4 4 4-4" />
            </svg>
          </button>
          {openMobileSubmenu === "matches" && (
            <div id="mobile-sub-matches" className="mobile-nav__sub">
              <Link
                className={`sub ${pathname === "/matches" ? "is-active" : ""}`}
                href="/matches"
                onClick={closeNav}
              >
                Live Matches &amp; Fixtures
              </Link>
              <Link
                className={`sub ${pathname === "/tournaments" ? "is-active" : ""}`}
                href="/tournaments"
                onClick={closeNav}
              >
                Tournaments &amp; Cups
              </Link>
              <Link
                className={`sub ${pathname === "/ground-booking" ? "is-active" : ""}`}
                href="/ground-booking"
                onClick={closeNav}
              >
                Ground Booking
              </Link>
              <Link
                className={`sub ${pathname === "/my-bookings" ? "is-active" : ""}`}
                href="/my-bookings"
                onClick={closeNav}
              >
                My Slot Bookings
              </Link>
            </div>
          )}
        </div>

        <Link
          href="/branches"
          className={pathname.startsWith("/branches") ? "is-active" : ""}
          onClick={closeNav}
        >
          Branches
        </Link>
        <Link
          href="/gallery"
          className={pathname.startsWith("/gallery") ? "is-active" : ""}
          onClick={closeNav}
        >
          Gallery
        </Link>
        <Link
          href="/shop"
          className={pathname.startsWith("/shop") ? "is-active" : ""}
          onClick={closeNav}
        >
          Pro Store
        </Link>
        {isLoggedIn ? (
          <button
            type="button"
            className="text-start text-danger border-0 bg-transparent py-3 font-weight-bold"
            style={{ fontSize: "17px" }}
            onClick={handleLogout}
          >
            Logout ({displayName})
          </button>
        ) : (
          <Link href="/login" onClick={closeNav}>
            Login
          </Link>
        )}
      </nav>
    </>
  );
}
