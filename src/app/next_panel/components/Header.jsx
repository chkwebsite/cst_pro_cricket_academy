"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { ChevronDown, Globe, LogOut, Menu, UserCircle, X, Shield } from "lucide-react";
import { logout } from "../../components/utils/auth";
import { useUser } from "./UserContext";
import styles from "./Header.module.css";

function getDisplayName(user) {
    return [user?.first_name, user?.last_name].filter(Boolean).join(" ") || "User";
}

export default function Header({ onToggleSidebar, isMobileOpen = false }) {
    const router = useRouter();
    const menuRef = useRef(null);
    const { user } = useUser();
    const [isOpen, setIsOpen] = useState(false);

    useEffect(() => {
        function closeOnOutsideClick(event) {
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        }

        document.addEventListener("mousedown", closeOnOutsideClick);
        return () => document.removeEventListener("mousedown", closeOnOutsideClick);
    }, []);

    const displayName = getDisplayName(user);
    const imageUrl = typeof user?.profile_image === "string"
        ? user.profile_image.trimEnd()
        : "";
    const userRole = user?.user_type || "Admin";

    return (
        <header className={styles.header}>
            <div className={styles.leftSection}>
                {/* Mobile / Tablet Hamburger Toggle Button */}
                <button
                    type="button"
                    className={styles.hamburgerBtn}
                    onClick={onToggleSidebar}
                    aria-label={isMobileOpen ? "Close navigation" : "Open navigation"}
                    aria-expanded={isMobileOpen}
                >
                    {isMobileOpen ? <X size={22} /> : <Menu size={22} />}
                </button>

                {/* Logo visible on Mobile / Tablet or header branding */}
                <Link href="/next_panel/dashboard" className={styles.headerBrand} title="CST Pro Cricket Academy">
                    <img
                        src="/images/website/logo.png"
                        alt="CST Pro Cricket Academy"
                        className={styles.headerLogo}
                    />
                </Link>

                <div className={styles.headerTagline}>
                    <span className={styles.academyName}>CST Pro Cricket Academy</span>
                    <span className={styles.portalTag}>Management Panel</span>
                </div>
            </div>

            <div className={styles.rightSection}>
                {/* Quick Link to Public Website */}
                <Link
                    href="/"
                    target="_blank"
                    className={styles.websiteBtn}
                    title="Open public website in a new tab"
                >
                    <Globe size={15} />
                    <span className={styles.websiteBtnText}>Visit Website</span>
                </Link>

                {/* User Menu */}
                <div className={styles.userMenu} ref={menuRef}>
                    <button
                        type="button"
                        className={styles.userButton}
                        onClick={() => setIsOpen((open) => !open)}
                        aria-expanded={isOpen}
                        aria-label="Open user menu"
                    >
                        {imageUrl ? (
                            <Image className={styles.avatar} src={imageUrl} width={32} height={32} alt="" unoptimized />
                        ) : (
                            <div className={styles.avatarFallback}>
                                <UserCircle size={32} strokeWidth={1.8} />
                            </div>
                        )}
                        <div className={styles.userMeta}>
                            <span className={styles.userName}>{displayName}</span>
                            <span className={styles.userRoleBadge}>{userRole}</span>
                        </div>
                        <ChevronDown size={15} className={`${styles.chevron} ${isOpen ? styles.chevronOpen : ""}`} />
                    </button>

                    {isOpen && (
                        <div className={styles.dropdown} role="menu">
                            <div className={styles.userSummary}>
                                {imageUrl ? (
                                    <Image className={styles.largeAvatar} src={imageUrl} width={42} height={42} alt="" unoptimized />
                                ) : (
                                    <div className={styles.largeAvatarFallback}>
                                        <UserCircle size={42} strokeWidth={1.5} />
                                    </div>
                                )}
                                <div className={styles.userDetails}>
                                    <strong className={styles.detailName}>{displayName}</strong>
                                    <span className={styles.detailEmail}>{user?.email || user?.appointment_no || "Signed-in user"}</span>
                                    <span className={styles.detailRole}>
                                        <Shield size={12} className="inline me-1" />
                                        {userRole}
                                    </span>
                                </div>
                                <button
                                    type="button"
                                    className={styles.closeButton}
                                    onClick={() => setIsOpen(false)}
                                    aria-label="Close user menu"
                                >
                                    <X size={16} />
                                </button>
                            </div>

                            <div className={styles.divider} />

                            <Link
                                href="/"
                                target="_blank"
                                className={styles.dropdownLink}
                                onClick={() => setIsOpen(false)}
                            >
                                <Globe size={15} />
                                <span>Preview Public Website</span>
                            </Link>

                            <div className={styles.divider} />

                            <button
                                type="button"
                                className={styles.logoutButton}
                                onClick={() => logout(router)}
                                role="menuitem"
                            >
                                <LogOut size={16} />
                                <span>Sign Out</span>
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </header>
    );
}
