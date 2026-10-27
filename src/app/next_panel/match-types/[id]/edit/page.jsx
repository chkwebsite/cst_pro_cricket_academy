"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import MatchTypeForm from "../../MatchTypeForm";

export default function EditMatchTypePage() {
    const { id } = useParams();
    const [matchType, setMatchType] = useState(null);
    const [error, setError] = useState(null);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const res = await fetch(`/api/match-types/${id}`);
                const json = await res.json().catch(() => ({}));
                if (!res.ok || !json.success) throw new Error(json.message || "Failed to load match type");
                if (!cancelled) setMatchType(json.data);
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
                <Link href="/next_panel/match-types" className="btn btn-outline-secondary">Back to match types</Link>
            </div>
        );
    }

    if (!matchType) {
        return (
            <div className="container-fluid">
                <div className="bg-white rounded-4 shadow-sm p-5 text-center text-muted">Loading match type...</div>
            </div>
        );
    }

    return <MatchTypeForm initial={matchType} matchTypeId={id} />;
}
