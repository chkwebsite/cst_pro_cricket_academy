"use client";

import { useEffect, useState } from "react";
import { ROLES } from "../teams/useCurrentUser";

// ⚠ Assumption: tournaments are served by /api/tournaments as { success, data }.
const TOURNAMENTS_API = "/api/tournaments";

/*
| Loads tournaments for dropdowns.
| Academy / branch admins only receive tournaments of their own academy.
*/
export default function useTournamentOptions(me) {
    const [tournaments, setTournaments] = useState([]);
    const [error, setError] = useState("");

    useEffect(() => {
        if (!me.ready || !me.role) return;
        const scoped = me.role !== ROLES.SUPER;
        if (scoped && !me.academyId) return;

        const controller = new AbortController();

        (async () => {
            try {
                const url = scoped ? `${TOURNAMENTS_API}?academy_id=${me.academyId}` : TOURNAMENTS_API;
                const res = await fetch(url, { signal: controller.signal });
                const json = await res.json();
                if (!res.ok || !json.success) throw new Error(json.message || "Unable to load tournaments");

                let rows = json.data || [];
                // Even if the API ignores ?academy_id, never show other academies
                if (scoped) rows = rows.filter((t) => Number(t.academy_id) === Number(me.academyId));
                setTournaments(rows);
            } catch (err) {
                if (err.name !== "AbortError") setError(err.message);
            }
        })();

        return () => controller.abort();
    }, [me.ready, me.role, me.academyId]);

    return { tournaments, error };
}
