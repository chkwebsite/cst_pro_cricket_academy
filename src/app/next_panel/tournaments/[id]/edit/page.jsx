"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import TournamentForm from "../../TournamentForm";
import { BASE } from "../../shared";

export default function EditTournamentPage() {
    const { id } = useParams();
    const [tournament, setTournament] = useState(null);
    const [error, setError] = useState(null);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const res = await fetch(`/api/tournaments/${id}`);
                const json = await res.json().catch(() => ({}));
                if (!res.ok || !json.success) throw new Error(json.message || "Failed to load tournament");
                if (!cancelled) setTournament(json.data);
            } catch (err) {
                if (!cancelled) setError(err.message);
            }
        })();
        return () => { cancelled = true; };
    }, [id]);

    if (error) {
        return (
            <div className="container-fluid">
                <div className="alert alert-danger">{error}</div>
                <Link href={BASE} className="btn btn-outline-secondary">Back to tournaments</Link>
            </div>
        );
    }

    if (!tournament) {
        return (
            <div className="container-fluid">
                <div className="bg-white rounded-4 shadow-sm p-5 text-center text-muted">Loading tournament...</div>
            </div>
        );
    }

    return <TournamentForm initial={tournament} tournamentId={id} />;
}
