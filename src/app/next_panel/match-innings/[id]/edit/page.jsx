import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import MatchInningsForm from "../../MatchInningsForm";

export default async function MatchInningsEdit({ params }) {
    const { id } = await params;

    return (
        <div className="container-fluid">
            <div className="row g-4">
                <div className="col-12">
                    <div className="bg-white rounded-4 shadow-sm p-4 mb-4">
                        <Link href="/next_panel/match-innings" className="btn btn-sm btn-outline-secondary mb-3">
                            <ArrowLeft size={16} className="me-2" /> Back to Match Innings
                        </Link>
                        <h1 className="h4 mb-0">Edit Match Innings #{id}</h1>
                        <p className="text-muted mb-0">Update score, wickets, overs, extras, and status.</p>
                    </div>
                </div>
                <div className="col-12">
                    <div className="bg-white rounded-4 shadow-sm p-4">
                        <Suspense fallback={<div className="text-center py-4">Loading form...</div>}>
                            <MatchInningsForm id={id} />
                        </Suspense>
                    </div>
                </div>
            </div>
        </div>
    );
}
