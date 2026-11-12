"use client";

import { useEffect, useState } from "react";
import { ROLES } from "./useCurrentUser";

// A branch belongs to an academy (rows without academy_id are not filtered out)
export const inAcademy = (branch, academyId) =>
    branch.academy_id === undefined || Number(branch.academy_id) === Number(academyId);

/*
| Loads academies (/api/academies) and branches (/api/branch) for dropdowns.
| Academy / branch admins only ever receive their own academy and its branches.
*/
export default function useOrgOptions(me) {
    const [academies, setAcademies] = useState([]);
    const [branches, setBranches] = useState([]);
    const [error, setError] = useState("");

    useEffect(() => {
        if (!me.ready || !me.role) return;
        if (me.role !== ROLES.SUPER && !me.academyId) return;

        const controller = new AbortController();
        const scoped = me.role !== ROLES.SUPER;

        const load = async () => {
            try {
                const opts = { signal: controller.signal };
                const branchUrl = scoped ? `/api/branch?academy_id=${me.academyId}` : "/api/branch";

                const [aRes, bRes] = await Promise.all([fetch("/api/academies", opts), fetch(branchUrl, opts)]);
                const [aJson, bJson] = await Promise.all([aRes.json(), bRes.json()]);

                if (!aRes.ok || !aJson.success) throw new Error(aJson.message || "Unable to load academies");
                if (!bRes.ok || !bJson.success) throw new Error(bJson.message || "Unable to load branches");

                let a = aJson.data || [];
                let b = bJson.data || [];

                // Even if the API ignores ?academy_id, never show other academies
                if (scoped) {
                    a = a.filter((x) => Number(x.id) === Number(me.academyId));
                    b = b.filter((x) => inAcademy(x, me.academyId));
                }

                setAcademies(a);
                setBranches(b);
            } catch (err) {
                if (err.name !== "AbortError") setError(err.message);
            }
        };

        load();
        return () => controller.abort();
    }, [me.ready, me.role, me.academyId]);

    return { academies, branches, error };
}
