"use client";

import { useEffect, useState } from "react";
import { ROLES } from "../teams/useCurrentUser";

/*
| Loads teams (/api/teams) for dropdowns.
| Academy / branch admins only receive teams of their own academy.
*/
export default function useTeamOptions(me) {
    const [teams, setTeams] = useState([]);
    const [error, setError] = useState("");

    useEffect(() => {
        if (!me.ready || !me.role) return;
        const scoped = me.role !== ROLES.SUPER;
        if (scoped && !me.academyId) return;

        const controller = new AbortController();

        (async () => {
            try {
                const res = await fetch(scoped ? `/api/teams?academy_id=${me.academyId}` : "/api/teams", {
                    signal: controller.signal,
                });
                const json = await res.json();
                if (!res.ok || !json.success) throw new Error(json.message || "Unable to load teams");

                let rows = json.data || [];
                if (scoped) {
                    rows = rows.filter(
                        (t) => Number(t.academy_id) === Number(me.academyId) ||
                            (t.academy_id == null && t.branch_id == null)
                    );
                }
                setTeams(rows);
            } catch (err) {
                if (err.name !== "AbortError") setError(err.message);
            }
        })();

        return () => controller.abort();
    }, [me.ready, me.role, me.academyId]);

    return { teams, error };
}
