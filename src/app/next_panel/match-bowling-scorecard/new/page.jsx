import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import MatchBowlingScorecardForm from "../MatchBowlingScorecardForm";
import { resolveManagementNavigation } from "../../components/managementNavigation";

export default async function MatchBowlingScorecardNew({ searchParams }) {
    const navigation = resolveManagementNavigation(
        await searchParams,
        "/next_panel/match-bowling-scorecard",
        "Back to Bowling Scorecard"
    );

    return (
        <div className="container-fluid">
            <div className="row g-4">
                <div className="col-12">
                    <div className="bg-white rounded-4 shadow-sm p-4 mb-4">
                        <Link href={navigation.href} className="btn btn-sm btn-outline-secondary mb-3">
                            <ArrowLeft size={16} className="me-2" /> {navigation.label}
                        </Link>
                        <h1 className="h4 mb-0">Add Bowling Scorecard Entry</h1>
                        <p className="text-muted mb-0">Record overs, maidens, runs conceded, wickets, and extras for a bowler.</p>
                    </div>
                </div>
                <div className="col-12">
                    <div className="bg-white rounded-4 shadow-sm p-4">
                        <Suspense fallback={<div className="text-center py-4">Loading form...</div>}>
                            <MatchBowlingScorecardForm returnTo={navigation.href} />
                        </Suspense>
                    </div>
                </div>
            </div>
        </div>
    );
}
