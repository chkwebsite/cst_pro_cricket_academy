import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import MatchScorecardForm from "../MatchScorecardForm";
import { resolveManagementNavigation } from "../../components/managementNavigation";

export default async function MatchScorecardNew({ searchParams }) {
    const navigation = resolveManagementNavigation(
        await searchParams,
        "/next_panel/match-scorecard",
        "Back to Batting Scorecard"
    );

    return (
        <div className="container-fluid">
            <div className="row g-4">
                <div className="col-12">
                    <div className="bg-white rounded-4 shadow-sm p-4 mb-4">
                        <Link href={navigation.href} className="btn btn-sm btn-outline-secondary mb-3">
                            <ArrowLeft size={16} className="me-2" /> {navigation.label}
                        </Link>
                        <h1 className="h4 mb-0">Add Batting Scorecard Entry</h1>
                        <p className="text-muted mb-0">Record runs, balls, boundaries, and dismissal information for a batter.</p>
                    </div>
                </div>
                <div className="col-12">
                    <div className="bg-white rounded-4 shadow-sm p-4">
                        <Suspense fallback={<div className="text-center py-4">Loading form...</div>}>
                            <MatchScorecardForm returnTo={navigation.href} />
                        </Suspense>
                    </div>
                </div>
            </div>
        </div>
    );
}
