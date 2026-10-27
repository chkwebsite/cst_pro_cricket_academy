"use client";

import { useEffect, useState } from "react";
import { ROLES } from "../teams/useCurrentUser";

const ACADEMY_PLAYERS_API = "/api/admission-players";

const userLabel = (u) =>
    u.name || [u.first_name, u.last_name].filter(Boolean).join(" ").trim() || u.email || `User #${u.id}`;

/*
| Loads the two kinds of players a team can have:
|   users          -> team_players.user_id            (academy players)
|   outsidePlayers -> team_players.outside_player_id  (/api/outside-players)
*/
export default function usePlayerOptions(me) {
    const [users, setUsers] = useState([]);
    const [outsidePlayers, setOutsidePlayers] = useState([]);
    const [error, setError] = useState("");

    useEffect(() => {
        if (!me.ready || !me.role) return;
        const scoped = me.role !== ROLES.SUPER;
        if (scoped && !me.academyId) return;

        const controller = new AbortController();
        const opts = { signal: controller.signal };

        (async () => {
            const errors = [];

            try {
                const params = new URLSearchParams({ role_id: "7" });
                if (scoped) params.set("academy_id", me.academyId);

                const res = await fetch(`${ACADEMY_PLAYERS_API}?${params.toString()}`, opts);
                const json = await res.json();
                if (!res.ok || !json.success) throw new Error(json.message || "Unable to load academy players");

                const rows = (json.data || []).filter(
                    (player) => Number(player.role_id) === 7 && player.user_id
                );
                setUsers(rows.map((player) => ({
                    id: player.user_id,
                    label: userLabel(player),
                    email: player.email,
                })));
            } catch (err) {
                if (err.name !== "AbortError") errors.push(err.message);
            }

            try {
                const res = await fetch("/api/outside-players?status=1", opts);
                const json = await res.json();
                if (!res.ok || !json.success) throw new Error(json.message || "Unable to load outside players");
                setOutsidePlayers((json.data || []).map((p) => ({ id: p.id, label: p.player_name, email: p.email })));
            } catch (err) {
                if (err.name !== "AbortError") errors.push(err.message);
            }

            setError(errors.join(" | "));
        })();

        return () => controller.abort();
    }, [me.ready, me.role, me.academyId]);

    return { users, outsidePlayers, error };
}
