"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

export default function Pagination({
    page = 1,
    totalPages = 1,
    total = 0,
    onPageChange,
    pageSize = 10,
    shownCount = null,
}) {
    if (totalPages <= 1) return null;

    const currentPage = Number(page) || 1;
    const maxPages = Number(totalPages) || 1;

    // Generate page numbers to show (e.g. 1 ... 4 5 6 ... 10)
    const getPageNumbers = () => {
        const pages = [];
        const delta = 1; // pages around current

        for (let i = 1; i <= maxPages; i++) {
            if (
                i === 1 ||
                i === maxPages ||
                (i >= currentPage - delta && i <= currentPage + delta)
            ) {
                pages.push(i);
            } else if (pages[pages.length - 1] !== "...") {
                pages.push("...");
            }
        }
        return pages;
    };

    const startIdx = total === 0 ? 0 : (currentPage - 1) * pageSize + 1;
    const endIdx = Math.min(currentPage * pageSize, total);

    return (
        <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mt-3 pt-3 border-top">
            <small className="text-muted">
                Showing{" "}
                <strong>
                    {startIdx}–{endIdx}
                </strong>{" "}
                of <strong>{total}</strong> record{total === 1 ? "" : "s"}
            </small>

            <nav aria-label="Table pagination">
                <ul className="pagination pagination-sm mb-0">
                    <li className={`page-item ${currentPage <= 1 ? "disabled" : ""}`}>
                        <button
                            type="button"
                            className="page-link"
                            onClick={() => onPageChange(currentPage - 1)}
                            disabled={currentPage <= 1}
                            aria-label="Previous"
                        >
                            <ChevronLeft size={14} className="inline" /> Prev
                        </button>
                    </li>

                    {getPageNumbers().map((p, idx) =>
                        p === "..." ? (
                            <li key={`ellipsis-${idx}`} className="page-item disabled">
                                <span className="page-link">…</span>
                            </li>
                        ) : (
                            <li
                                key={`page-${p}`}
                                className={`page-item ${currentPage === p ? "active" : ""}`}
                            >
                                <button
                                    type="button"
                                    className="page-link"
                                    onClick={() => onPageChange(p)}
                                >
                                    {p}
                                </button>
                            </li>
                        )
                    )}

                    <li className={`page-item ${currentPage >= maxPages ? "disabled" : ""}`}>
                        <button
                            type="button"
                            className="page-link"
                            onClick={() => onPageChange(currentPage + 1)}
                            disabled={currentPage >= maxPages}
                            aria-label="Next"
                        >
                            Next <ChevronRight size={14} className="inline" />
                        </button>
                    </li>
                </ul>
            </nav>
        </div>
    );
}
