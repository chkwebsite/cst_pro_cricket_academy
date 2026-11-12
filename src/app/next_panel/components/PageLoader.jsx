"use client";

import { createContext, useContext, useState, useMemo } from "react";
import styles from "./PageLoader.module.css";

export const PageLoadingContext = createContext({
    isPageLoading: false,
    setIsPageLoading: () => {},
    loaderMessage: "",
    setLoaderMessage: () => {},
});

export function usePageLoading() {
    return useContext(PageLoadingContext);
}

export function PageProgressBar({ active = false }) {
    return (
        <div
            className={`${styles.topProgressBar} ${active ? styles.barActive : ""}`}
            aria-hidden="true"
        >
            <div className={styles.barIndicator} />
        </div>
    );
}

export function PageLoaderCard({
    title = "Loading Page",
    subtitle = "Please wait while the page is preparing...",
}) {
    return (
        <div className={styles.loaderCard} role="status" aria-live="polite">
            <div className={styles.spinnerWrapper}>
                <div className={styles.spinnerOuter} />
                <div className={styles.spinnerInner} />
                <div className={styles.spinnerCore} />
            </div>
            <h3 className={styles.loaderTitle}>
                {title}
                <span className={styles.dot1}>.</span>
                <span className={styles.dot2}>.</span>
                <span className={styles.dot3}>.</span>
            </h3>
            {subtitle && <p className={styles.loaderSubtitle}>{subtitle}</p>}
        </div>
    );
}

export default function PageLoader({
    message = "Loading Page",
    subtitle = "Please wait while the page is preparing...",
    overlay = false,
}) {
    if (overlay) {
        return (
            <div className={styles.pageLoadingOverlay}>
                <PageLoaderCard title={message} subtitle={subtitle} />
            </div>
        );
    }

    return (
        <div className={styles.pageLoaderStandalone}>
            <PageLoaderCard title={message} subtitle={subtitle} />
        </div>
    );
}
