import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import MatchBowlingScorecardForm from "../../MatchBowlingScorecardForm";

export default async function MatchBowlingScorecardEdit({ params }) {
    const { id } = await params;

    return (
        <div className="container-fluid">
            <div className="row g-4">
                <div className="col-12">
                    <div className="bg-white rounded-4 shadow-sm p-4 mb-4">
                        <Link href="/next_panel/match-bowling-scorecard" className="btn btn-sm btn-outline-secondary mb-3">
                            <ArrowLeft size={16} className="me-2" /> Back to Bowling Scorecard
                        </Link>
                        <h1 className="h4 mb-0">Edit Bowling Scorecard Entry #{id}</h1>
                        <p className="text-muted mb-0">Update overs, maidens, runs, wickets, and extras.</p>
                    </div>
                </div>
                <div className="col-12">
                    <div className="bg-white rounded-4 shadow-sm p-4">
                        <Suspense fallback={<div className="text-center py-4">Loading form...</div>}>
                            <MatchBowlingScorecardForm id={id} />
                        </Suspense>
                    </div>
                </div>
            </div>
        </div>
    );
}
