"use client";

import { useState, useEffect } from "react";
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
  logoAlt = "ST Cricket Academy logo",
}) {
  const pathname = usePathname();
  const { user, isLoggedIn, logout } = useUser();
  const { itemCount, setDrawerOpen } = useCart();
  const [isSticky, setIsSticky] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);

  const displayName = getDisplayName(user);

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
    setUserDropdownOpen(false);
  }

  const isActive = (path) => {
    if (path === "/" && pathname === "/") return true;
    if (path !== "/" && pathname.startsWith(path)) return true;
    return false;
  };

  const isDropdownActive = () => {
    return (
      pathname.startsWith("/about") ||
      pathname.startsWith("/ground-booking") ||
      pathname.startsWith("/rules") ||
      pathname.startsWith("/coaches") ||
      pathname.startsWith("/programs") ||
      pathname.startsWith("/branches")
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
            <Link href="/contact">Book a Free Trial</Link>
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
                  onClick={() => {
                    logout();
                    window.location.href = "/";
                  }}
                  className="btn btn-link text-white-50 p-0 text-decoration-none small hover-white"
                  title="Logout"
                >
                  <i className="bi bi-box-arrow-right text-white"></i>
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
      <nav
        className={`navbar navbar-expand-lg sticky-top ${
          isSticky ? "is-sticky" : ""
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
                    isDropdownActive() ? "active" : ""
                  }`}
                  href="#"
                  id="academyMenu"
                  role="button"
                  aria-expanded={dropdownOpen}
                  onClick={(e) => {
                    e.preventDefault();
                    setDropdownOpen((prev) => !prev);
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
                        isActive("/rules") ? "active" : ""
                      }`}
                      href="/rules"
                      onClick={() => setNavOpen(false)}
                    >
                      Rules &amp; Regulations
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
                </ul>
              </li>

              <li className="nav-item">
                <Link
                  className={`nav-link ${
                    isActive("/gallery") ? "active" : ""
                  }`}
                  href="/gallery"
                  onClick={() => setNavOpen(false)}
                >
                  Photo Gallery
                </Link>
              </li>

              <li className="nav-item">
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
                  className={`nav-item dropdown user-nav-dropdown ${userDropdownOpen ? "show" : ""}`}
                  onMouseEnter={() => {
                    if (typeof window !== "undefined" && window.innerWidth >= 992) {
                      setUserDropdownOpen(true);
                    }
                  }}
                  onMouseLeave={() => {
                    if (typeof window !== "undefined" && window.innerWidth >= 992) {
                      setUserDropdownOpen(false);
                    }
                  }}
                >
                  <button
                    className="nav-link dropdown-toggle btn btn-link d-inline-flex align-items-center gap-2 border-0 bg-transparent text-white px-2 px-lg-3 py-2 text-decoration-none"
                    type="button"
                    id="userAccountMenu"
                    aria-expanded={userDropdownOpen}
                    onClick={(e) => {
                      e.preventDefault();
                      setUserDropdownOpen((prev) => !prev);
                    }}
                  >
                    <span
                      className="rounded-circle d-inline-flex align-items-center justify-content-center fw-bold shadow-sm flex-shrink-0"
                      style={{
                        width: "32px",
                        height: "32px",
                        background: "var(--navy)",
                        color: "var(--lime)",
                        border: "2px solid var(--lime)",
                        fontSize: "0.85rem",
                      }}
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
                      style={{ maxWidth: "130px" }}
                    >
                      {displayName}
                    </span>
                  </button>

                  <ul
                    className={`dropdown-menu dropdown-menu-end shadow-lg border-0 rounded-4 p-2 ${
                      userDropdownOpen ? "show" : ""
                    }`}
                    aria-labelledby="userAccountMenu"
                    style={{
                      minWidth: "250px",
                      marginTop: "6px",
                      boxShadow: "0 12px 35px rgba(6, 47, 56, 0.22)",
                    }}
                  >
                    {/* Header info */}
                    <li className="px-3 py-2 bg-light rounded-3 mb-2 border">
                      <div className="fw-bold text-navy text-truncate fs-6">
                        {displayName}
                      </div>
                      <div className="d-flex align-items-center gap-2 mt-1">
                        <span
                          className="badge"
                          style={{
                            background: "var(--navy)",
                            color: "var(--lime)",
                            fontSize: "0.7rem",
                            fontWeight: 600,
                            padding: "0.22rem 0.6rem",
                            borderRadius: "50px",
                          }}
                        >
                          {user.user_type || "Public User"}
                        </span>
                      </div>
                      {user.email && (
                        <div className="text-secondary small text-truncate mt-1" style={{ fontSize: "0.78rem" }}>
                          <i className="bi bi-envelope me-1 text-muted"></i>
                          {user.email}
                        </div>
                      )}
                      {user.phone && (
                        <div className="text-secondary small text-truncate" style={{ fontSize: "0.78rem" }}>
                          <i className="bi bi-telephone me-1 text-muted"></i>
                          {user.phone}
                        </div>
                      )}
                    </li>

                    {/* 1. User Profile */}
                    <li>
                      <Link
                        className="dropdown-item py-2 px-3 rounded-2 d-flex align-items-center gap-2 fw-semibold text-navy hover-bg-light"
                        href="/profile"
                        onClick={() => {
                          setNavOpen(false);
                          setUserDropdownOpen(false);
                        }}
                      >
                        <i className="bi bi-person-circle fs-5 text-teal"></i>
                        <span>User Profile</span>
                      </Link>
                    </li>

                    {/* 2. User Orders */}
                    <li>
                      <Link
                        className="dropdown-item py-2 px-3 rounded-2 d-flex align-items-center gap-2 fw-semibold text-navy hover-bg-light"
                        href="/orders"
                        onClick={() => {
                          setNavOpen(false);
                          setUserDropdownOpen(false);
                        }}
                      >
                        <i className="bi bi-bag-check-fill fs-5 text-success"></i>
                        <span>User Orders</span>
                      </Link>
                    </li>

                    {/* Admin Portal link if academy user */}
                    {!user.is_public && user.user_type !== "Public User" && (
                      <li>
                        <Link
                          className="dropdown-item py-2 px-3 rounded-2 d-flex align-items-center gap-2 fw-semibold text-navy hover-bg-light"
                          href="/next_panel/dashboard"
                          onClick={() => {
                            setNavOpen(false);
                            setUserDropdownOpen(false);
                          }}
                        >
                          <i className="bi bi-speedometer2 fs-5 text-danger"></i>
                          <span>Academy Portal</span>
                        </Link>
                      </li>
                    )}

                    <li>
                      <hr className="dropdown-divider my-2" />
                    </li>

                    {/* 3. Logout */}
                    <li>
                      <button
                        type="button"
                        className="dropdown-item py-2 px-3 rounded-2 d-flex align-items-center gap-2 fw-semibold text-danger border-0 bg-transparent w-100 text-start"
                        onClick={() => {
                          setUserDropdownOpen(false);
                          setNavOpen(false);
                          logout();
                          window.location.href = "/";
                        }}
                      >
                        <i className="bi bi-box-arrow-right fs-5"></i>
                        <span>Logout</span>
                      </button>
                    </li>
                  </ul>
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
    </>
  );
}
