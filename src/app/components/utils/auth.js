"use client";

export async function logout(router) {
    try {
        await Promise.allSettled([
            fetch("/api/auth/logout", { method: "POST" }),
            fetch("/api/public-auth/logout", { method: "POST" }),
        ]);
    } finally {
        try {
            if (typeof window !== "undefined") {
                sessionStorage.removeItem("auth_session");
                sessionStorage.removeItem("auth_user");
                sessionStorage.removeItem("auth_permissions");
                localStorage.removeItem("auth_session");
                localStorage.removeItem("auth_user");
                localStorage.removeItem("auth_permissions");
                window.dispatchEvent(new Event("auth-session-change"));
            }
        } catch (_) {}

        if (router && typeof router.replace === "function") {
            router.replace("/login");
        } else if (typeof window !== "undefined") {
            window.location.href = "/login";
        }
    }
}
