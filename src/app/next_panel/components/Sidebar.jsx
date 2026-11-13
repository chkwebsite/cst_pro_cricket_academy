"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
    Activity,
    Banknote,
    Calendar,
    CalendarCheck,
    ChevronDown,
    ChevronRight,
    Circle,
    CreditCard,
    DollarSign,
    Film,
    FolderTree,
    Image,
    Images,
    Layers,
    LayoutDashboard,
    Menu,
    Package,
    Receipt,
    Settings,
    ShieldCheck,
    Key,
    ShoppingBag,
    ShoppingCart,
    UserCheck,
    Users,
    Video,
    X,
    RefreshCw,
} from "lucide-react";
import styles from "./Sidebar.module.css";
import Header from "./Header";
import { useUser } from "./UserContext";
import { getUserRole, ROLES } from "../../components/lib/rbac-rules";
import PageLoader, { PageProgressBar, PageLoadingContext } from "./PageLoader";

const iconMap = {
    "player-dashboard": LayoutDashboard,
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
    key: Key,
    "password-resets": Key,
    calendar: Calendar,
    "calendar-check": CalendarCheck,
    attendance: CalendarCheck,
    "staff-user-management": Users,
    "user-weekly-off": Calendar,
    "staff-salary": CreditCard,
    "staff-salary-payments": Banknote,
    "staff-salary-transactions": Receipt,
    banknote: Banknote,
    receipt: Receipt,
    "dollar-sign": DollarSign,
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

function MenuNode({ menu, siblingMenus, pathname, openMenus, setOpenMenus, closeSidebar, onNavigate }) {
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
                    onClick={() => {
                        closeSidebar();
                        if (onNavigate && menuPath !== pathname) {
                            onNavigate(menuPath);
                        }
                    }}
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
                            onNavigate={onNavigate}
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
    const [menusLoading, setMenusLoading] = useState(true);
    const [menuReloadKey, setMenuReloadKey] = useState(0);
    const [openMenus, setOpenMenus] = useState(new Set());
    const [isMobileOpen, setIsMobileOpen] = useState(false);
    const [error, setError] = useState("");

    // Page route transition & manual loading states
    const [isRouteLoading, setIsRouteLoading] = useState(false);
    const [isManualLoading, setIsManualLoading] = useState(false);
    const isPageLoading = isRouteLoading || isManualLoading;

    const handleNavigate = (targetPath) => {
        if (targetPath && targetPath !== pathname) {
            setIsRouteLoading(true);
        }
    };

    const handleRetryMenus = () => {
        setMenuReloadKey((k) => k + 1);
    };

    // When pathname changes, route transition has completed
    useEffect(() => {
        const timer = setTimeout(() => {
            setIsRouteLoading(false);
            setIsManualLoading(false);
        }, 150);
        return () => clearTimeout(timer);
    }, [pathname]);

    // Safety timeout so page loader NEVER gets stuck indefinitely
    useEffect(() => {
        if (!isPageLoading) return;
        const safetyTimer = setTimeout(() => {
            setIsRouteLoading(false);
            setIsManualLoading(false);
        }, 2500);
        return () => clearTimeout(safetyTimer);
    }, [isPageLoading]);

    // Safety timeout so menu skeleton loader NEVER gets stuck
    useEffect(() => {
        if (!menusLoading) return;
        const menuSafetyTimer = setTimeout(() => {
            setMenusLoading(false);
        }, 3000);
        return () => clearTimeout(menuSafetyTimer);
    }, [menusLoading]);

    // Intercept clicks on links pointing to /next_panel and browser history navigation
    useEffect(() => {
        function handleLinkClick(e) {
            const anchor = e.target.closest("a");
            if (!anchor) return;
            const href = anchor.getAttribute("href");
            if (
                href &&
                href.startsWith("/next_panel") &&
                !anchor.target &&
                !e.ctrlKey &&
                !e.metaKey &&
                !e.shiftKey
            ) {
                try {
                    const url = new URL(anchor.href, window.location.origin);
                    if (url.pathname !== window.location.pathname) {
                        setIsRouteLoading(true);
                    }
                } catch (_) {}
            }
        }

        function handlePopState() {
            setIsRouteLoading(true);
        }

        document.addEventListener("click", handleLinkClick);
        window.addEventListener("popstate", handlePopState);

        return () => {
            document.removeEventListener("click", handleLinkClick);
            window.removeEventListener("popstate", handlePopState);
        };
    }, []);

    const currentUserType = String(user?.user_type || user?.role || "").toLowerCase().trim();
    const isPlayer = currentUserType.includes("player") || currentUserType === "7" || getUserRole(user) === ROLES.PLAYER;
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
            setMenusLoading(true);
            setError("");
            try {
                const response = await fetch(
                    "/api/menu?limit=100&is_sidebar=1&is_active=1&status=1&is_deleted=0",
                    { cache: "no-store" }
                );
                const result = await response.json();

                if (!response.ok || !result.success) {
                    throw new Error(result.message || "Unable to load navigation");
                }

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
                const effectiveUser = session?.user || user;
                const role = getUserRole(effectiveUser);
                const userIsPlayer = role === ROLES.PLAYER || userType.includes("player") || userType === "7";

                let filtered = [];

                if (role === ROLES.SUPER_ADMIN || userIsSuperAdmin) {
                    // Super admin has all menus
                    filtered = [...allMenus];
                } else if (role === ROLES.ACADEMY_ADMIN) {
                    // Academy Admin: Full operational modules, strictly excluding System Menus & external Academies master
                    const systemKeys = new Set(["Menus", "Menu", "Menu-p", "Permissions", "Roles", "User roles", "Permissions_in", "Academies"]);
                    filtered = allMenus.filter((m) => {
                        if (systemKeys.has(m.menu_key) || systemKeys.has(m.menu_name)) return false;
                        if ([3, 10].includes(m.parent_id)) return false;
                        if (m.menu_url && (
                            m.menu_url.includes("/menu") ||
                            m.menu_url.includes("/permissions") ||
                            m.menu_url.includes("/academies") ||
                            m.menu_url.includes("/player-dashboard")
                        )) return false;
                        return true;
                    });
                } else if (role === ROLES.BRANCH_ADMIN) {
                    // Branch Admin: Branch-level operations only, excluding Academy & Branch configuration & System Menus
                    const branchExcludedKeys = new Set(["Menus", "Menu", "Menu-p", "Permissions", "Roles", "User roles", "Permissions_in", "Academies", "Branches"]);
                    filtered = allMenus.filter((m) => {
                        if (branchExcludedKeys.has(m.menu_key) || branchExcludedKeys.has(m.menu_name)) return false;
                        if ([3, 10].includes(m.parent_id) || m.id === 7) return false;
                        if (m.menu_url && (
                            m.menu_url.includes("/menu") ||
                            m.menu_url.includes("/permissions") ||
                            m.menu_url.includes("/academies") ||
                            m.menu_url.includes("/branches") ||
                            m.menu_url.includes("/player-dashboard")
                        )) return false;
                        return true;
                    });
                } else if (role === ROLES.ACCOUNTANT) {
                    // Accountant: ONLY accounts and finance related modules + Attendance + Dashboard
                    const accountantUrls = new Set([
                        "/next_panel/dashboard",
                        "/next_panel/attendance",
                        "/next_panel/fee-status",
                        "/next_panel/fee-payments",
                        "/next_panel/player-attendance",
                        "/next_panel/player-program-fees",
                        "/next_panel/player-payments",
                        "/next_panel/player-fees-matrix",
                        "/next_panel/ground-payments",
                        "/next_panel/orders",
                        "/next_panel/order-payments",
                    ]);
                    filtered = allMenus.filter((m) => {
                        if (m.id === 34 || m.menu_key === "accounts") return true;
                        if (m.id === 54 || m.menu_key === "Product_Master") return false;
                        return accountantUrls.has(m.menu_url);
                    });
                } else if (role === ROLES.COACH) {
                    // Coach: Dashboard, My Attendance, My Batches, My Batch Players, Player Attendance, Player Fee Dues
                    const coachUrls = new Set([
                        "/next_panel/dashboard",
                        "/next_panel/attendance",
                        "/next_panel/batches",
                        "/next_panel/batch-players",
                        "/next_panel/player-attendance",
                        "/next_panel/fee-status",
                        "/next_panel/player-program-fees",
                    ]);
                    const coachItems = allMenus
                        .filter((m) => coachUrls.has(m.menu_url))
                        .map((m) => {
                            if (m.menu_url === "/next_panel/dashboard") {
                                return { ...m, parent_id: null, menu_name: "Dashboard", menu_title: "Dashboard", menu_icon: "layout-dashboard", menu_order: 0 };
                            }
                            if (m.menu_url === "/next_panel/attendance") {
                                return { ...m, parent_id: null, menu_name: "My Attendance", menu_title: "My Attendance", menu_icon: "calendar-check", menu_order: 1 };
                            }
                            if (m.menu_url === "/next_panel/batches") {
                                return { ...m, parent_id: null, menu_name: "My Batches", menu_title: "My Batches", menu_order: 2 };
                            }
                            if (m.menu_url === "/next_panel/batch-players") {
                                return { ...m, parent_id: null, menu_name: "My Batch Players", menu_title: "My Batch Players", menu_order: 3 };
                            }
                            if (m.menu_url === "/next_panel/player-attendance") {
                                return { ...m, parent_id: null, menu_name: "Player Attendance", menu_title: "Player Attendance", menu_order: 4 };
                            }
                            if (m.menu_url === "/next_panel/player-program-fees" || m.menu_url === "/next_panel/fee-status") {
                                return { ...m, parent_id: null, menu_name: "Player Fee Dues", menu_title: "Player Fee Dues", menu_order: 5 };
                            }
                            return { ...m, parent_id: null };
                        });
                    // Ensure Dashboard is always included for Coach
                    if (!coachItems.some((m) => m.menu_url === "/next_panel/dashboard")) {
                        coachItems.unshift({
                            id: 99990,
                            parent_id: null,
                            menu_key: "dashboard",
                            menu_name: "Dashboard",
                            menu_title: "Dashboard",
                            menu_url: "/next_panel/dashboard",
                            menu_icon: "layout-dashboard",
                            menu_order: 0,
                        });
                    }
                    // Remove duplicate fee item if both match
                    const seenUrls = new Set();
                    filtered = coachItems.filter((item) => {
                        if (item.menu_name === "Player Fee Dues") {
                            if (seenUrls.has("fee_dues")) return false;
                            seenUrls.add("fee_dues");
                        }
                        return true;
                    }).sort((a, b) => (Number(a.menu_order) || 99) - (Number(b.menu_order) || 99));
                } else if (userIsPlayer) {
                    // PLAYER SPECIFIC MENU RULES:
                    // 1. "Player Dashboard" is shown at the top. General "Dashboard" (/next_panel/dashboard) is removed.
                    // 2. "Product master" and administrative management menus MUST NOT be shown.
                    // 3. Permitted player menus: Player Dashboard, My Attendance, My Fee Status, My Program Fees, Ground Availability, Ground Bookings, My Orders.
                    const playerAllowedUrls = new Set([
                        "/next_panel/player-dashboard",
                        "/next_panel/attendance",
                        "/next_panel/fee-status",
                        "/next_panel/player-program-fees",
                        "/next_panel/ground-availability",
                        "/next_panel/ground-bookings",
                        "/next_panel/orders",
                        "/next_panel/my-orders",
                    ]);

                    (Array.isArray(permissions) ? permissions : []).forEach((p) => {
                        const url = typeof p === "string" ? normalizeMenuPath(p) : normalizeMenuPath(p?.menu_url);
                        if (
                            url &&
                            url !== "/" &&
                            url !== "/next_panel/dashboard" &&
                            !url.includes("product") &&
                            !url.includes("stock") &&
                            !url.includes("order-payments")
                        ) {
                            playerAllowedUrls.add(url);
                        }
                    });

                    const playerItems = allMenus
                        .filter((m) => {
                            // Strictly remove general dashboard for player
                            if (
                                m.menu_url === "/next_panel/dashboard" ||
                                m.menu_key === "dashboard"
                            ) return false;
                            if (m.id === 54 || m.menu_key === "Product_Master" || m.menu_key === "store-management") return false;
                            if (["product-categories", "products", "product-images", "product-stock", "order-payments"].includes(m.menu_key)) return false;
                            const normUrl = normalizeMenuPath(m.menu_url);
                            return playerAllowedUrls.has(normUrl) || playerAllowedUrls.has(m.menu_url) || m.menu_key === "player-dashboard";
                        })
                        .map((m) => {
                            // Present player items cleanly at top level
                            const normUrl = normalizeMenuPath(m.menu_url);
                            if (normUrl === "/next_panel/player-dashboard" || m.menu_key === "player-dashboard") {
                                return {
                                    ...m,
                                    parent_id: null,
                                    menu_url: "/next_panel/player-dashboard",
                                    menu_name: "Player Dashboard",
                                    menu_title: "Player Dashboard",
                                    menu_icon: "player-dashboard",
                                    menu_order: 0,
                                };
                            }
                            if (normUrl === "/next_panel/attendance" || m.menu_key === "attendance") {
                                return {
                                    ...m,
                                    parent_id: null,
                                    menu_url: "/next_panel/attendance",
                                    menu_name: "My Attendance",
                                    menu_title: "My Attendance",
                                    menu_icon: "calendar-check",
                                    menu_order: 1,
                                };
                            }
                            if (normUrl === "/next_panel/fee-status" || m.menu_key === "match-fee-status" || m.menu_key === "fee-status") {
                                return {
                                    ...m,
                                    parent_id: null,
                                    menu_url: "/next_panel/fee-status",
                                    menu_name: "My Fee Status",
                                    menu_title: "My Fee Status",
                                    menu_icon: "fee-status",
                                    menu_order: 2,
                                };
                            }
                            if (normUrl === "/next_panel/player-program-fees" || m.menu_key === "player-program-fees") {
                                return {
                                    ...m,
                                    parent_id: null,
                                    menu_url: "/next_panel/player-program-fees",
                                    menu_name: "My Program Fees",
                                    menu_title: "My Program Fees",
                                    menu_icon: "receipt",
                                    menu_order: 3,
                                };
                            }
                            if (normUrl === "/next_panel/ground-availability" || m.menu_key === "ground-availability") {
                                return {
                                    ...m,
                                    parent_id: null,
                                    menu_url: "/next_panel/ground-availability",
                                    menu_name: "Ground Availability",
                                    menu_title: "Ground Availability",
                                    menu_icon: "ground-availability",
                                    menu_order: 4,
                                };
                            }
                            if (normUrl === "/next_panel/ground-bookings" || m.menu_key === "ground-bookings") {
                                return {
                                    ...m,
                                    parent_id: null,
                                    menu_url: "/next_panel/ground-bookings",
                                    menu_name: "Ground Bookings",
                                    menu_title: "Ground Bookings",
                                    menu_icon: "ground-bookings",
                                    menu_order: 5,
                                };
                            }
                            if (normUrl === "/next_panel/orders" || m.menu_key === "orders" || normUrl === "/next_panel/my-orders") {
                                return {
                                    ...m,
                                    parent_id: null,
                                    menu_url: "/next_panel/orders",
                                    menu_name: "My Orders",
                                    menu_title: "My Orders",
                                    menu_icon: "shopping-bag",
                                    menu_order: 6,
                                };
                            }
                            return {
                                ...m,
                                parent_id: null,
                                menu_url: normUrl,
                            };
                        });

                    if (!playerItems.some((m) => normalizeMenuPath(m.menu_url) === "/next_panel/player-dashboard" || m.menu_key === "player-dashboard")) {
                        playerItems.unshift({
                            id: 99991,
                            parent_id: null,
                            menu_key: "player-dashboard",
                            menu_name: "Player Dashboard",
                            menu_title: "Player Dashboard",
                            menu_url: "/next_panel/player-dashboard",
                            menu_icon: "player-dashboard",
                            menu_order: 0,
                        });
                    }

                    if (!playerItems.some((m) => normalizeMenuPath(m.menu_url) === "/next_panel/attendance")) {
                        playerItems.push({
                            id: 99997,
                            parent_id: null,
                            menu_key: "attendance",
                            menu_name: "My Attendance",
                            menu_title: "My Attendance",
                            menu_url: "/next_panel/attendance",
                            menu_icon: "calendar-check",
                            menu_order: 1,
                        });
                    }

                    if (!playerItems.some((m) => normalizeMenuPath(m.menu_url) === "/next_panel/fee-status")) {
                        playerItems.push({
                            id: 99996,
                            parent_id: null,
                            menu_key: "fee-status",
                            menu_name: "My Fee Status",
                            menu_title: "My Fee Status",
                            menu_url: "/next_panel/fee-status",
                            menu_icon: "fee-status",
                            menu_order: 2,
                        });
                    }

                    if (!playerItems.some((m) => normalizeMenuPath(m.menu_url) === "/next_panel/player-program-fees")) {
                        playerItems.push({
                            id: 99994,
                            parent_id: null,
                            menu_key: "player-program-fees",
                            menu_name: "My Program Fees",
                            menu_title: "My Program Fees",
                            menu_url: "/next_panel/player-program-fees",
                            menu_icon: "receipt",
                            menu_order: 3,
                        });
                    }

                    if (!playerItems.some((m) => normalizeMenuPath(m.menu_url) === "/next_panel/ground-availability")) {
                        playerItems.push({
                            id: 99995,
                            parent_id: null,
                            menu_key: "ground-availability",
                            menu_name: "Ground Availability",
                            menu_title: "Ground Availability",
                            menu_url: "/next_panel/ground-availability",
                            menu_icon: "ground-availability",
                            menu_order: 4,
                        });
                    }

                    if (!playerItems.some((m) => normalizeMenuPath(m.menu_url) === "/next_panel/ground-bookings")) {
                        playerItems.push({
                            id: 99993,
                            parent_id: null,
                            menu_key: "ground-bookings",
                            menu_name: "Ground Bookings",
                            menu_title: "Ground Bookings",
                            menu_url: "/next_panel/ground-bookings",
                            menu_icon: "ground-bookings",
                            menu_order: 5,
                        });
                    }

                    if (!playerItems.some((m) => normalizeMenuPath(m.menu_url) === "/next_panel/orders")) {
                        playerItems.push({
                            id: 99998,
                            parent_id: null,
                            menu_key: "orders",
                            menu_name: "My Orders",
                            menu_title: "My Orders",
                            menu_url: "/next_panel/orders",
                            menu_icon: "shopping-bag",
                            menu_order: 6,
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

                // =====================================================
                // GUARANTEE DASHBOARD MENU AT TOP FOR ALL USERS
                // =====================================================
                if (userIsPlayer) {
                    // For Player: Remove general "/next_panel/dashboard", and guarantee Player Dashboard is at the top
                    filtered = filtered.filter(
                        (m) =>
                            m.menu_url !== "/next_panel/dashboard" &&
                            m.menu_key !== "dashboard"
                    );

                    const existingPlayerDashIdx = filtered.findIndex(
                        (m) => m.menu_url === "/next_panel/player-dashboard" || m.menu_key === "player-dashboard"
                    );

                    if (existingPlayerDashIdx > -1) {
                        const [dashItem] = filtered.splice(existingPlayerDashIdx, 1);
                        filtered.unshift({
                            ...dashItem,
                            parent_id: null,
                            menu_name: "Player Dashboard",
                            menu_title: "Player Dashboard",
                            menu_icon: dashItem.menu_icon || "player-dashboard",
                            menu_order: 0,
                        });
                    } else {
                        filtered.unshift({
                            id: 99991,
                            parent_id: null,
                            menu_key: "player-dashboard",
                            menu_name: "Player Dashboard",
                            menu_title: "Player Dashboard",
                            menu_url: "/next_panel/player-dashboard",
                            menu_icon: "player-dashboard",
                            menu_order: 0,
                        });
                    }
                } else {
                    const targetDashboardUrl = "/next_panel/dashboard";
                    const targetDashboardTitle = "Dashboard";
                    const targetDashboardIcon = "layout-dashboard";

                    const existingDashIdx = filtered.findIndex(
                        (m) => m.menu_url === targetDashboardUrl || m.menu_url === "/next_panel/dashboard" || m.menu_key === "dashboard"
                    );

                    if (existingDashIdx > -1) {
                        const [dashItem] = filtered.splice(existingDashIdx, 1);
                        filtered.unshift({
                            ...dashItem,
                            parent_id: null,
                            menu_name: dashItem.menu_name || targetDashboardTitle,
                            menu_title: dashItem.menu_title || targetDashboardTitle,
                            menu_icon: dashItem.menu_icon || targetDashboardIcon,
                            menu_order: 0,
                        });
                    } else {
                        filtered.unshift({
                            id: 99990,
                            parent_id: null,
                            menu_key: "dashboard",
                            menu_name: targetDashboardTitle,
                            menu_title: targetDashboardTitle,
                            menu_url: targetDashboardUrl,
                            menu_icon: targetDashboardIcon,
                            menu_order: 0,
                        });
                    }
                }

                setMenus(filtered);
            } catch (loadError) {
                if (!cancelled) setError(loadError.message);
            } finally {
                setMenusLoading(false);
            }
        }

        loadMenus();
        return () => { cancelled = true; };
    }, [user, menuReloadKey]);

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
                        onClick={() => {
                            closeSidebar();
                            handleNavigate(isPlayer ? "/next_panel/player-dashboard" : "/next_panel/dashboard");
                        }}
                    >
                        <img
                            src="/images/website/CSTCricketAcademyLogo.png"
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
                    {menusLoading ? (
                        <div className={styles.menuSkeletonContainer} aria-busy="true" aria-label="Loading navigation menu">
                            <div className={styles.menuSkeletonHeader}>
                                <span className={styles.menuSkeletonSpinner} />
                                <span>Loading navigation...</span>
                            </div>
                            <div className={styles.menuSkeletonList}>
                                {[
                                    "68%", "52%", "78%", "60%", "85%",
                                    "48%", "64%", "72%", "56%"
                                ].map((w, index) => (
                                    <div key={index} className={styles.menuSkeletonItem}>
                                        <div className={styles.skeletonIconBox} />
                                        <div className={styles.skeletonTextBox} style={{ width: w }} />
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : error ? (
                        <div className={styles.menuErrorContainer}>
                            <p>{error}</p>
                            <button
                                type="button"
                                className={styles.retryBtn}
                                onClick={handleRetryMenus}
                            >
                                <RefreshCw size={13} />
                                Retry
                            </button>
                        </div>
                    ) : (
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
                                    onNavigate={handleNavigate}
                                />
                            ))}
                        </ul>
                    )}
                </nav>

                <div className={styles.sidebarFooter}>
                    <div className={styles.statusIndicator}>
                        <span className={styles.statusDot} />
                        <span>Academy Active</span>
                    </div>
                </div>
            </aside>

            {/* Main Page Content */}
            <main className={styles.content}>
                <PageProgressBar active={isPageLoading} />
                <div className={styles.contentInner}>
                    <PageLoadingContext.Provider
                        value={{
                            isPageLoading,
                            setIsPageLoading: setIsManualLoading,
                        }}
                    >
                        {isPageLoading && (
                            <PageLoader
                                overlay={true}
                                message="Loading Page"
                                subtitle="Please wait while the page is preparing..."
                            />
                        )}
                        {children}
                    </PageLoadingContext.Provider>
                </div>
            </main>
        </div>
    );
}
