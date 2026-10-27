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

const iconMap = {
    "layout-dashboard": LayoutDashboard,
    dashboard: LayoutDashboard,
    settings: Settings,
    users: Users,
    "public-users": Users,
    "shopping-bag": ShoppingBag,
    "store-management": ShoppingBag,
    products: Package,
    package: Package,
    "product-categories": FolderTree,
    "product-images": Images,
    "product-stock": Layers,
    orders: ShoppingCart,
    "shopping-cart": ShoppingCart,
    "order-payments": CreditCard,
    "credit-card": CreditCard,
    shield: ShieldCheck,
    calendar: Calendar,
    "calendar-check": CalendarCheck,
    "ground-booking-requests": CalendarCheck,
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
    const [menus, setMenus] = useState([]);
    const [openMenus, setOpenMenus] = useState(new Set());
    const [isMobileOpen, setIsMobileOpen] = useState(false);
    const [error, setError] = useState("");

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
                const userType = String(session?.user?.user_type || "").toLowerCase().trim();
                const isSuperAdmin =
                    userType.includes("super") ||
                    (Array.isArray(permissions) && (
                        permissions.includes("*") ||
                        permissions.some((p) => p === "*" || p?.permission_name === "*" || p?.menu_url === "*")
                    ));

                const allowedPaths = new Set(
                    (Array.isArray(permissions) ? permissions : [])
                        .map((permission) => {
                            if (typeof permission === "string") return normalizeMenuPath(permission);
                            return normalizeMenuPath(permission?.menu_url);
                        })
                        .filter(Boolean)
                );

                const allowedIds = isSuperAdmin
                    ? new Set(allMenus.map((menu) => menu.id))
                    : new Set(
                        allMenus
                            .filter(
                                (menu) =>
                                    allowedPaths.has(menu.menu_url) ||
                                    (userType.includes("admin") && (
                                        menu.menu_url === "/next_panel/public-users" ||
                                        menu.menu_url === "/next_panel/products" ||
                                        menu.menu_url === "/next_panel/product-categories" ||
                                        menu.menu_url === "/next_panel/product-images" ||
                                        menu.menu_url === "/next_panel/product-stock" ||
                                        menu.menu_url === "/next_panel/orders" ||
                                        menu.menu_key === "store-management" ||
                                        menu.menu_key === "Product_Master"
                                    ))
                            )
                            .map((menu) => menu.id)
                    );

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

                setMenus(allMenus.filter((menu) => allowedIds.has(menu.id)));
            } catch (loadError) {
                if (!cancelled) setError(loadError.message);
            }
        }

        loadMenus();
        return () => { cancelled = true; };
    }, []);

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
                    <Link href="/next_panel/dashboard" className={styles.brandLink} onClick={closeSidebar}>
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
                    <span className={styles.portalBadge}>Admin Portal</span>
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
