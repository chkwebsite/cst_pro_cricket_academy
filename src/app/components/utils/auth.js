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
                try {
                    document.cookie = "auth_token=; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT;";
                    document.cookie = "public_auth_token=; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT;";
                } catch (_) {}
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
