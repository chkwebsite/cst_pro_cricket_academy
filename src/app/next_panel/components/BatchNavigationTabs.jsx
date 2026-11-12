"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Layers, UserCheck, Users, Plus } from "lucide-react";

export default function BatchNavigationTabs({
    activeCount,
    coachesCount,
    playersCount,
    actionButton,
}) {
    const pathname = usePathname();

    const isBatches = pathname === "/next_panel/batches" || pathname.startsWith("/next_panel/batches/");
    const isCoaches = pathname === "/next_panel/batch-coaches" || pathname.startsWith("/next_panel/batch-coaches/");
    const isPlayers = pathname === "/next_panel/batch-players" || pathname.startsWith("/next_panel/batch-players/");

    return (
        <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-4 pb-2 border-bottom">
            <ul className="nav nav-pills gap-2">
                <li className="nav-item">
                    <Link
                        href="/next_panel/batches"
                        className={`nav-link d-flex align-items-center gap-2 fw-semibold px-3 py-2 ${
                            isBatches ? "active bg-primary text-white" : "bg-light text-dark border"
                        }`}
                    >
                        <Layers size={17} />
                        <span>Batches</span>
                        {activeCount !== undefined && (
                            <span
                                className={`badge rounded-pill ${
                                    isBatches ? "bg-white text-primary" : "bg-primary text-white"
                                }`}
                            >
                                {activeCount}
                            </span>
                        )}
                    </Link>
                </li>
                <li className="nav-item">
                    <Link
                        href="/next_panel/batch-coaches"
                        className={`nav-link d-flex align-items-center gap-2 fw-semibold px-3 py-2 ${
                            isCoaches ? "active bg-primary text-white" : "bg-light text-dark border"
                        }`}
                    >
                        <UserCheck size={17} />
                        <span>Batch Coaches</span>
                        {coachesCount !== undefined && (
                            <span
                                className={`badge rounded-pill ${
                                    isCoaches ? "bg-white text-primary" : "bg-primary text-white"
                                }`}
                            >
                                {coachesCount}
                            </span>
                        )}
                    </Link>
                </li>
                <li className="nav-item">
                    <Link
                        href="/next_panel/batch-players"
                        className={`nav-link d-flex align-items-center gap-2 fw-semibold px-3 py-2 ${
                            isPlayers ? "active bg-primary text-white" : "bg-light text-dark border"
                        }`}
                    >
                        <Users size={17} />
                        <span>Batch Players</span>
                        {playersCount !== undefined && (
                            <span
                                className={`badge rounded-pill ${
                                    isPlayers ? "bg-white text-primary" : "bg-primary text-white"
                                }`}
                            >
                                {playersCount}
                            </span>
                        )}
                    </Link>
                </li>
            </ul>

            <div className="d-flex align-items-center gap-2">
                {actionButton}
            </div>
        </div>
    );
}
