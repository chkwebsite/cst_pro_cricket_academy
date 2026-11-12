import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import MatchPlayerForm from "../MatchPlayerForm";
import { resolveManagementNavigation } from "../../components/managementNavigation";

export default async function MatchPlayerNew({ searchParams }) {
    const navigation = resolveManagementNavigation(
        await searchParams,
        "/next_panel/match-players",
        "Back to Match Players"
    );

    return (
        <div className="container-fluid">
            <div className="row g-4">
                <div className="col-12">
                    <div className="bg-white rounded-4 shadow-sm p-4 mb-4">
                        <Link href={navigation.href} className="btn btn-sm btn-outline-secondary mb-3">
                            <ArrowLeft size={16} className="me-2" /> {navigation.label}
                        </Link>
                        <h1 className="h4 mb-0">Add Match Player</h1>
                        <p className="text-muted mb-0">Select a player for a match.</p>
                    </div>
                </div>
                <div className="col-12">
                    <div className="bg-white rounded-4 shadow-sm p-4">
                        {/* useSearchParams in the form requires a Suspense boundary */}
                        <Suspense fallback={<div className="text-center py-4">Loading...</div>}>
                            <MatchPlayerForm returnTo={navigation.href} />
                        </Suspense>
                    </div>
                </div>
            </div>
        </div>
    );
}
