import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import MatchForm from "../../MatchForm";

export default async function MatchEdit({ params }) {
    const { id } = await params;
    return (
        <div className="container-fluid">
            <div className="row g-4">
                <div className="col-12">
                    <div className="bg-white rounded-4 shadow-sm p-4 mb-4">
                        <Link href="/next_panel/matches" className="btn btn-sm btn-outline-secondary mb-3">
                            <ArrowLeft size={16} className="me-2" /> Back to Matches
                        </Link>
                        <h1 className="h4 mb-0">Edit Match</h1>
                        <p className="text-muted mb-0">Update match details.</p>
                    </div>
                </div>
                <div className="col-sm-12">
                    <MatchForm id={id} />
                </div>
            </div>
        </div>
    );
}
