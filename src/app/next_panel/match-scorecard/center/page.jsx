import { Suspense } from "react";
import MatchCenterView from "../../components/MatchCenterView";

export default async function MatchScorecardCenterHubPage({ searchParams }) {
    const { match_id } = (await searchParams) || {};

    return (
        <Suspense fallback={<div className="text-center py-5">Loading match center...</div>}>
            <MatchCenterView initialMatchId={match_id || null} />
        </Suspense>
    );
}
