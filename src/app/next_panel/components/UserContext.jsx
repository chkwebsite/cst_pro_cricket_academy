"use client";

import { createContext, useContext, useEffect, useState } from "react";

const UserContext = createContext(null);

function getStoredSession() {
    try {
        if (typeof window === "undefined") return null;
        const s = window.sessionStorage.getItem("auth_session");
        if (s && s !== "null") return JSON.parse(s);

        const l = window.localStorage.getItem("auth_session");
        if (l && l !== "null") {
            try {
                window.sessionStorage.setItem("auth_session", l);
            } catch (_) {}
            return JSON.parse(l);
        }

        const u = window.sessionStorage.getItem("auth_user") || window.localStorage.getItem("auth_user");
        if (u && u !== "null") {
            try {
                const parsedUser = JSON.parse(u);
                return { user: parsedUser, permissions: [] };
            } catch (_) {}
        }

        return null;
    } catch {
        return null;
    }
}

export function UserProvider({ children, initialSession = null }) {
    const [session, setSession] = useState(() => {
        if (typeof window !== "undefined") {
            const stored = getStoredSession();
            if (stored) return stored;
        }
        return initialSession || null;
    });

    // Populate storage from initialSession if storage is empty
    useEffect(() => {
        if (typeof window === "undefined") return;
        if (initialSession && initialSession.user) {
            const hasSessionStorage = Boolean(window.sessionStorage.getItem("auth_session"));
            const hasLocalStorage = Boolean(window.localStorage.getItem("auth_session"));

            if (!hasSessionStorage || !hasLocalStorage) {
                try {
                    const sStr = JSON.stringify(initialSession);
                    window.sessionStorage.setItem("auth_session", sStr);
                    window.localStorage.setItem("auth_session", sStr);
                    if (initialSession.user) {
                        const uStr = JSON.stringify(initialSession.user);
                        window.sessionStorage.setItem("auth_user", uStr);
                        window.localStorage.setItem("auth_user", uStr);
                    }
                } catch (_) {}
            }
        }
    }, [initialSession]);

    // Listen to cross-tab (storage) and same-tab (auth-session-change) events
    useEffect(() => {
        if (typeof window === "undefined") return;

        function syncSession() {
            const stored = getStoredSession();
            setSession(stored);
        }

        window.addEventListener("storage", syncSession);
        window.addEventListener("auth-session-change", syncSession);

        return () => {
            window.removeEventListener("storage", syncSession);
            window.removeEventListener("auth-session-change", syncSession);
        };
    }, []);

    // Background verify with /api/auth/me to ensure token freshness and server sync
    useEffect(() => {
        if (typeof window === "undefined") return;

        let isMounted = true;
        async function verifySession() {
            try {
                const res = await fetch("/api/auth/me");
                if (!isMounted) return;
                const json = await res.json();

                if (res.ok && json.success && json.session) {
                    setSession(json.session);
                    const newStr = JSON.stringify(json.session);
                    window.sessionStorage.setItem("auth_session", newStr);
                    window.localStorage.setItem("auth_session", newStr);
                    if (json.session.user) {
                        const uStr = JSON.stringify(json.session.user);
                        window.sessionStorage.setItem("auth_user", uStr);
                        window.localStorage.setItem("auth_user", uStr);
                    }
                } else if (res.status === 401) {
                    setSession(null);
                    if (typeof window !== "undefined") {
                        window.sessionStorage.removeItem("auth_session");
                        window.sessionStorage.removeItem("auth_user");
                        window.sessionStorage.removeItem("auth_permissions");
                        window.localStorage.removeItem("auth_session");
                        window.localStorage.removeItem("auth_user");
                        window.localStorage.removeItem("auth_permissions");
                    }
                }
            } catch (_) {
                // Ignore network errors
            }
        }

        verifySession();

        return () => {
            isMounted = false;
        };
    }, []);

    const logout = async (redirectUrl = null) => {
        try {
            if (typeof window !== "undefined") {
                window.sessionStorage.removeItem("auth_session");
                window.sessionStorage.removeItem("auth_user");
                window.sessionStorage.removeItem("auth_permissions");
                window.localStorage.removeItem("auth_session");
                window.localStorage.removeItem("auth_user");
                window.localStorage.removeItem("auth_permissions");
                try {
                    document.cookie = "auth_token=; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT;";
                    document.cookie = "public_auth_token=; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT;";
                } catch (_) {}
                window.dispatchEvent(new Event("auth-session-change"));
            }

            setSession(null);

            await Promise.allSettled([
                fetch("/api/auth/logout", { method: "POST" }),
                fetch("/api/public-auth/logout", { method: "POST" }),
            ]);
        } catch (err) {
            console.error("UserContext logout error:", err);
        } finally {
            if (redirectUrl && typeof window !== "undefined") {
                window.location.href = redirectUrl;
            }
        }
    };

    const login = (sessionData) => {
        try {
            if (typeof window !== "undefined" && sessionData) {
                const sessionStr = JSON.stringify(sessionData);
                window.sessionStorage.setItem("auth_session", sessionStr);
                window.localStorage.setItem("auth_session", sessionStr);

                if (sessionData.user) {
                    const userStr = JSON.stringify(sessionData.user);
                    window.sessionStorage.setItem("auth_user", userStr);
                    window.localStorage.setItem("auth_user", userStr);
                }
                if (sessionData.permissions) {
                    const permStr = JSON.stringify(sessionData.permissions);
                    window.sessionStorage.setItem("auth_permissions", permStr);
                    window.localStorage.setItem("auth_permissions", permStr);
                }
                window.dispatchEvent(new Event("auth-session-change"));
            }
            setSession(sessionData);
        } catch {
            // ignore
        }
    };

    const user = session?.user || null;
    const isLoggedIn = Boolean(user);
    const isPublic = Boolean(
        user?.is_public ||
        user?.user_type?.toLowerCase()?.includes("public")
    );

    return (
        <UserContext.Provider value={{ session, user, isLoggedIn, isPublic, logout, login }}>
            {children}
        </UserContext.Provider>
    );
}

export function useUser() {
    const context = useContext(UserContext);

    if (!context) {
        return {
            session: null,
            user: null,
            isLoggedIn: false,
            isPublic: false,
            logout: () => {
                if (typeof window !== "undefined") {
                    window.sessionStorage.removeItem("auth_session");
                    window.sessionStorage.removeItem("auth_user");
                    window.sessionStorage.removeItem("auth_permissions");
                    window.localStorage.removeItem("auth_session");
                    window.localStorage.removeItem("auth_user");
                    window.localStorage.removeItem("auth_permissions");
                    window.dispatchEvent(new Event("auth-session-change"));
                }
            },
            login: () => {},
        };
    }

    return context;
}
