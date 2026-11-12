import { Suspense } from "react";
import MatchCenterView from "../../../components/MatchCenterView";

export default async function MatchScorecardCenterPage({ params }) {
    const { id } = await params;

    return (
        <Suspense fallback={<div className="text-center py-5">Loading scorecard...</div>}>
            <MatchCenterView initialMatchId={id} />
        </Suspense>
    );
}
