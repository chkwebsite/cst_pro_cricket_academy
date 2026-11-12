import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import TournamentTeamForm from "../TournamentTeamForm";
import { resolveManagementNavigation } from "../../components/managementNavigation";

export default async function TournamentTeamNew({ searchParams }) {
    const navigation = resolveManagementNavigation(
        await searchParams,
        "/next_panel/tournament-teams",
        "Back to Tournament Teams"
    );

    return (
        <div className="container-fluid">
            <div className="row g-4">
                <div className="col-12">
                    <div className="bg-white rounded-4 shadow-sm p-4 mb-4">
                        <Link href={navigation.href} className="btn btn-sm btn-outline-secondary mb-3">
                            <ArrowLeft size={16} className="me-2" /> {navigation.label}
                        </Link>
                        <h1 className="h4 mb-0">Register Team</h1>
                        <p className="text-muted mb-0">Register a team in a tournament.</p>
                    </div>
                </div>

                <div className="col-12">
                    <div className="bg-white rounded-4 shadow-sm p-4">
                        <TournamentTeamForm returnTo={navigation.href} />
                    </div>
                </div>
            </div>
        </div>
    );
}
