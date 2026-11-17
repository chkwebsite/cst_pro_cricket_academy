"use client";

import { createContext, useContext, useState, useEffect } from "react";
import { usePathname } from "next/navigation";

const TrialModalContext = createContext({
    isOpen: false,
    openModal: () => {},
    closeModal: () => {},
});

export function TrialModalProvider({ children }) {
    const [isOpen, setIsOpen] = useState(false);
    const pathname = usePathname();

    const openModal = () => setIsOpen(true);
    const closeModal = () => setIsOpen(false);

    // Global click listener to intercept clicks on "Book Free Trial" links
    // on the home page and throughout the website (except on /book-free-trial itself)
    useEffect(() => {
        function handleGlobalClick(e) {
            // Don't intercept if already on /book-free-trial
            if (pathname === "/book-free-trial") return;

            const target = e.target.closest("a, button");
            if (!target) return;

            const href = target.getAttribute("href") || "";
            const isTrialLink =
                href === "/book-free-trial" ||
                href.startsWith("/book-free-trial?") ||
                target.getAttribute("data-trial-modal") === "true";

            if (isTrialLink) {
                e.preventDefault();
                e.stopPropagation();
                openModal();
            }
        }

        document.addEventListener("click", handleGlobalClick, true);
        return () => {
            document.removeEventListener("click", handleGlobalClick, true);
        };
    }, [pathname]);

    return (
        <TrialModalContext.Provider value={{ isOpen, openModal, closeModal }}>
            {children}
        </TrialModalContext.Provider>
    );
}

export function useTrialModal() {
    const context = useContext(TrialModalContext);
    if (!context) {
        throw new Error("useTrialModal must be used within a TrialModalProvider");
    }
    return context;
}
