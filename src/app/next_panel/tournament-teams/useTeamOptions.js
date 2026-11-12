"use client";

import { useEffect, useState } from "react";

/*
| Loads all teams (/api/teams) for tournament-team dropdowns.
*/
export default function useTeamOptions(me) {
    const [teams, setTeams] = useState([]);
    const [error, setError] = useState("");

    useEffect(() => {
        if (!me.ready || !me.role) return;

        const controller = new AbortController();

        (async () => {
            try {
                const res = await fetch("/api/teams", { signal: controller.signal });
                const json = await res.json();
                if (!res.ok || !json.success) throw new Error(json.message || "Unable to load teams");

                setTeams(json.data || []);
            } catch (err) {
                if (err.name !== "AbortError") setError(err.message);
            }
        })();

        return () => controller.abort();
    }, [me.ready, me.role]);

    return { teams, error };
}
