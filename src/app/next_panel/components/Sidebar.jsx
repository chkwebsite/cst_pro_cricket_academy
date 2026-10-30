"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
    Activity,
    Calendar,
    CalendarCheck,
    ChevronDown,
    ChevronRight,
    Circle,
    CreditCard,
    Film,
    FolderTree,
    Image,
    Images,
    Layers,
    LayoutDashboard,
    Menu,
    Package,
    Settings,
    ShieldCheck,
    ShoppingBag,
    ShoppingCart,
    UserCheck,
    Users,
    Video,
    X,
} from "lucide-react";
import styles from "./Sidebar.module.css";
import Header from "./Header";
import { useUser } from "./UserContext";

const iconMap = {
    "player-dashboard": UserCheck,
    "my-orders": ShoppingBag,
    orders: ShoppingBag,
    "shopping-bag": ShoppingBag,
    "shopping-cart": ShoppingCart,
    "layout-dashboard": LayoutDashboard,
    dashboard: LayoutDashboard,
    settings: Settings,
    users: Users,
    "public-users": Users,
    "store-management": ShoppingBag,
    products: Package,
    package: Package,
    "product-categories": FolderTree,
    "product-images": Images,
    "product-stock": Layers,
    "order-payments": CreditCard,
    "credit-card": CreditCard,
    "match-fee-status": CreditCard,
    "fee-status": CreditCard,
    shield: ShieldCheck,
    calendar: Calendar,
    "calendar-check": CalendarCheck,
    "ground-booking-requests": CalendarCheck,
    "ground-bookings": CalendarCheck,
    "ground-availability": Calendar,
    layers: Layers,
    batches: Layers,
    "user-check": UserCheck,
    "batch-coaches": UserCheck,
    "batch-players": Users,
    "individual-training": Activity,
    gallery: Images,
    "gallery-management": Images,
    "gallery-categories": FolderTree,
    "gallery-albums": Film,
    "gallery-images": Image,
    "gallery-videos": Video,
};

function normalizePath(value) {
    if (!value || value === "/") return "/";
    const path = value.startsWith("/") ? value : `/${value}`;
    return path.length > 1 ? path.replace(/\/$/, "") : path;
}

function normalizeMenuPath(value) {
    const path = normalizePath(value);
    if (path === "/") return path;
    return path.startsWith("/next_panel/") ? path : `/next_panel${path}`;
}

function buildTree(menus) {
    const byId = new Map(menus.map((menu) => [menu.id, { ...menu, children: [] }]));
    const roots = [];

    byId.forEach((menu) => {
        if (menu.parent_id && byId.has(menu.parent_id)) {
            byId.get(menu.parent_id).children.push(menu);
        } else {
            roots.push(menu);
        }
    });

    return roots;
}

function hasVisibleMenu(menu) {
    return Boolean(menu.menu_url) || menu.children.some(hasVisibleMenu);
}

function MenuIcon({ name }) {
    const Icon = iconMap[String(name || "").toLowerCase()] || Circle;
    return <Icon size={17} strokeWidth={1.8} aria-hidden="true" />;
}

function MenuNode({ menu, siblingMenus, pathname, openMenus, setOpenMenus, closeSidebar }) {
    const menuPath = normalizePath(menu.menu_url);
    const hasChildren = menu.children.length > 0;
    const isActive = menuPath !== "/" && (pathname === menuPath || pathname.startsWith(`${menuPath}/`));
    const hasOpenSibling = siblingMenus.some((sibling) => sibling.id !== menu.id && openMenus.has(sibling.id));
    const isOpen = openMenus.has(menu.id) || (isActive && !hasOpenSibling);

    function toggleMenu() {
        setOpenMenus((current) => {
            const next = new Set(current);
            if (next.has(menu.id)) next.delete(menu.id);
            else {
                siblingMenus.forEach((sibling) => {
                    if (sibling.id !== menu.id) next.delete(sibling.id);
                });
                next.add(menu.id);
            }
            return next;
        });
    }

    return (
        <li className={styles.menuItem}>
            {hasChildren ? (
                <button
                    type="button"
                    className={`${styles.menuButton} ${isActive ? styles.active : ""}`}
                    onClick={toggleMenu}
                    aria-expanded={isOpen}
                >
                    <span className={styles.menuLabel}>
                        <MenuIcon name={menu.menu_icon} />
                        <span>{menu.menu_title || menu.menu_name}</span>
                    </span>
                    {isOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                </button>
            ) : (
                <Link
                    href={menuPath}
                    className={`${styles.menuButton} ${isActive ? styles.active : ""}`}
                    onClick={closeSidebar}
                >
                    <span className={styles.menuLabel}>
                        <MenuIcon name={menu.menu_icon} />
                        <span>{menu.menu_title || menu.menu_name}</span>
                    </span>
                </Link>
            )}

            {hasChildren && isOpen && (
                <ul className={styles.submenu}>
                    {menu.children.map((child) => (
                        <MenuNode
                            key={child.id}
                            menu={child}
                            siblingMenus={menu.children}
                            pathname={pathname}
                            openMenus={openMenus}
                            setOpenMenus={setOpenMenus}
                            closeSidebar={closeSidebar}
                        />
                    ))}
                </ul>
            )}
        </li>
    );
}

export default function Sidebar({ children }) {
    const pathname = usePathname();
    const { user } = useUser();
    const [menus, setMenus] = useState([]);
    const [openMenus, setOpenMenus] = useState(new Set());
    const [isMobileOpen, setIsMobileOpen] = useState(false);
    const [error, setError] = useState("");

    const currentUserType = String(user?.user_type || "").toLowerCase().trim();
    const isPlayer = currentUserType.includes("player") || currentUserType === "7";
    const isSuperAdmin = currentUserType === "super admin" || currentUserType === "superadmin" || currentUserType.includes("super");

    // Prevent body scroll when mobile sidebar drawer is open
    useEffect(() => {
        if (isMobileOpen) {
            document.body.style.overflow = "hidden";
        } else {
            document.body.style.overflow = "";
        }
        return () => {
            document.body.style.overflow = "";
        };
    }, [isMobileOpen]);

    // Close mobile sidebar on route change
    const [prevPathname, setPrevPathname] = useState(pathname);
    if (prevPathname !== pathname) {
        setPrevPathname(pathname);
        setIsMobileOpen(false);
    }

    useEffect(() => {
        let cancelled = false;

        async function loadMenus() {
            try {
                const response = await fetch(
                    "/api/menu?limit=100&is_sidebar=1&is_active=1&status=1&is_deleted=0",
                    { cache: "no-store" }
                );
                const result = await response.json();

                if (!response.ok || !result.success) {
                    throw new Error(result.message || "Unable to load navigation");
                }

                if (cancelled) return;

                const allMenus = (result.data || []).map((menu) => ({
                    ...menu,
                    menu_url: normalizeMenuPath(menu.menu_url),
                    parent_id: menu.parent_id == null ? null : Number(menu.parent_id),
                }));

                const session = JSON.parse(sessionStorage.getItem("auth_session") || "null");
                const permissions = session?.permissions || JSON.parse(
                    sessionStorage.getItem("auth_permissions") || "[]"
                );
                const userType = String(session?.user?.user_type || user?.user_type || "").toLowerCase().trim();
                const userIsSuperAdmin =
                    userType === "super admin" ||
                    userType === "superadmin" ||
                    userType.includes("super") ||
                    (Array.isArray(permissions) && (
                        permissions.includes("*") ||
                        permissions.some((p) => p === "*" || p?.permission_name === "*" || p?.menu_url === "*")
                    ));
                const userIsPlayer = userType.includes("player") || userType === "7";

                let filtered = [];

                if (userIsSuperAdmin) {
                    // Super admin has all menus
                    filtered = [...allMenus];
                } else if (userIsPlayer) {
                    // PLAYER SPECIFIC MENU RULES:
                    // 1. "Product master" (menu_key: 'Product_Master' or id: 54) and admin product management menus (55, 56, 57, 58, 60) MUST NOT be shown.
                    // 2. Player's orders must be shown directly as "My Orders" at top level.
                    // 3. Player related menus (Player Dashboard, My Orders, Fee Status, Ground Availability/Bookings, etc.) are shown.
                    const playerAllowedUrls = new Set([
                        "/next_panel/player-dashboard",
                        "/next_panel/orders",
                        "/next_panel/fee-status",
                        "/next_panel/ground-availability",
                        "/next_panel/ground-bookings",
                    ]);

                    (Array.isArray(permissions) ? permissions : []).forEach((p) => {
                        const url = typeof p === "string" ? normalizeMenuPath(p) : normalizeMenuPath(p?.menu_url);
                        if (url && url !== "/" && !url.includes("product") && !url.includes("stock") && !url.includes("order-payments")) {
                            playerAllowedUrls.add(url);
                        }
                    });

                    const playerItems = allMenus
                        .filter((m) => {
                            if (m.id === 54 || m.menu_key === "Product_Master" || m.menu_key === "store-management") return false;
                            if (["product-categories", "products", "product-images", "product-stock", "order-payments"].includes(m.menu_key)) return false;
                            return playerAllowedUrls.has(m.menu_url);
                        })
                        .map((m) => {
                            // Present player items cleanly at top level
                            if (m.menu_url === "/next_panel/orders" || m.menu_key === "orders") {
                                return {
                                    ...m,
                                    parent_id: null,
                                    menu_name: "My Orders",
                                    menu_title: "My Orders",
                                    menu_icon: "shopping-bag",
                                    menu_order: 2,
                                };
                            }
                            if (m.menu_url === "/next_panel/player-dashboard" || m.menu_key === "player-dashboard") {
                                return {
                                    ...m,
                                    parent_id: null,
                                    menu_name: "Player Dashboard",
                                    menu_title: "Player Dashboard",
                                    menu_icon: "player-dashboard",
                                    menu_order: 1,
                                };
                            }
                            if (m.menu_url === "/next_panel/fee-status" || m.menu_key === "match-fee-status") {
                                return {
                                    ...m,
                                    parent_id: null,
                                    menu_name: "My Fee Status",
                                    menu_title: "My Fee Status",
                                    menu_icon: "credit-card",
                                    menu_order: 3,
                                };
                            }
                            return {
                                ...m,
                                parent_id: null,
                            };
                        });

                    if (!playerItems.some((m) => m.menu_url === "/next_panel/player-dashboard")) {
                        playerItems.unshift({
                            id: 99999,
                            parent_id: null,
                            menu_name: "Player Dashboard",
                            menu_title: "Player Dashboard",
                            menu_url: "/next_panel/player-dashboard",
                            menu_icon: "player-dashboard",
                            menu_order: 1,
                        });
                    }

                    if (!playerItems.some((m) => m.menu_url === "/next_panel/orders")) {
                        playerItems.push({
                            id: 99998,
                            parent_id: null,
                            menu_name: "My Orders",
                            menu_title: "My Orders",
                            menu_url: "/next_panel/orders",
                            menu_icon: "shopping-bag",
                            menu_order: 2,
                        });
                    }

                    playerItems.sort((a, b) => (Number(a.menu_order) || 99) - (Number(b.menu_order) || 99));
                    filtered = playerItems;
                } else {
                    // OTHER USER ROLES (Academy Admin, Branch Admin, Coach, Accountant, etc.):
                    // Strictly filter based on assigned role permissions in DB
                    const allowedPaths = new Set(
                        (Array.isArray(permissions) ? permissions : [])
                            .map((permission) => {
                                if (typeof permission === "string") return normalizeMenuPath(permission);
                                return normalizeMenuPath(permission?.menu_url);
                            })
                            .filter((p) => Boolean(p) && p !== "/")
                    );

                    const allowedMenuIds = new Set(
                        (Array.isArray(permissions) ? permissions : [])
                            .map((p) => (typeof p === "object" && p?.menu_id != null ? Number(p.menu_id) : null))
                            .filter((id) => id !== null)
                    );

                    const allowedIds = new Set(
                        allMenus
                            .filter(
                                (menu) =>
                                    allowedPaths.has(menu.menu_url) ||
                                    allowedMenuIds.has(menu.id)
                            )
                            .map((menu) => menu.id)
                    );

                    // Add parent menus for permitted children so the tree renders
                    let changed = true;
                    while (changed) {
                        changed = false;
                        allMenus.forEach((menu) => {
                            if (menu.parent_id && allowedIds.has(menu.id) && !allowedIds.has(menu.parent_id)) {
                                allowedIds.add(menu.parent_id);
                                changed = true;
                            }
                        });
                    }

                    filtered = allMenus.filter((menu) => allowedIds.has(menu.id));
                }

                setMenus(filtered);
            } catch (loadError) {
                if (!cancelled) setError(loadError.message);
            }
        }

        loadMenus();
        return () => { cancelled = true; };
    }, [user]);

    const tree = useMemo(() => buildTree(menus), [menus]);
    const closeSidebar = () => setIsMobileOpen(false);

    return (
        <div className={styles.panelShell}>
            <Header onToggleSidebar={() => setIsMobileOpen((open) => !open)} isMobileOpen={isMobileOpen} />

            {/* Mobile / Tablet Backdrop Overlay */}
            {isMobileOpen && (
                <button
                    type="button"
                    className={styles.backdrop}
                    onClick={closeSidebar}
                    aria-label="Close navigation"
                />
            )}

            {/* Responsive Sidebar Drawer */}
            <aside className={`${styles.sidebar} ${isMobileOpen ? styles.sidebarOpen : ""}`}>
                {/* Brand Logo Container */}
                <div className={styles.brandContainer}>
                    <Link
                        href={isPlayer ? "/next_panel/player-dashboard" : "/next_panel/dashboard"}
                        className={styles.brandLink}
                        onClick={closeSidebar}
                    >
                        <img
                            src="/images/website/logo.png"
                            alt="CST Pro Cricket Academy"
                            className={styles.brandLogo}
                        />
                    </Link>
                    <button
                        type="button"
                        className={styles.mobileCloseBtn}
                        onClick={closeSidebar}
                        aria-label="Close navigation"
                    >
                        <X size={20} />
                    </button>
                </div>

                <div className={styles.portalTagContainer}>
                    <span className={styles.portalBadge}>
                        {isPlayer ? "Player Portal" : isSuperAdmin ? "Super Admin Portal" : (user?.user_type || "Admin Portal")}
                    </span>
                </div>

                <div className={styles.navigationTitle}>Workspace Menu</div>

                <nav aria-label="Main navigation" className={styles.navScroll}>
                    <ul className={styles.menuList}>
                        {tree.filter(hasVisibleMenu).map((menu) => (
                            <MenuNode
                                key={menu.id}
                                menu={menu}
                                siblingMenus={tree}
                                pathname={pathname}
                                openMenus={openMenus}
                                setOpenMenus={setOpenMenus}
                                closeSidebar={closeSidebar}
                            />
                        ))}
                    </ul>
                </nav>

                {error && <p className={styles.error}>{error}</p>}

                <div className={styles.sidebarFooter}>
                    <div className={styles.statusIndicator}>
                        <span className={styles.statusDot} />
                        <span>Academy Active</span>
                    </div>
                </div>
            </aside>

            {/* Main Page Content */}
            <main className={styles.content}>
                <div className={styles.contentInner}>
                    {children}
                </div>
            </main>
        </div>
    );
}
