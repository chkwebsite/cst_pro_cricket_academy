import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import TournamentTeamPlayerForm from "../TournamentTeamPlayerForm";
import { resolveManagementNavigation } from "../../components/managementNavigation";

export default async function TournamentTeamPlayerNew({ searchParams }) {
    const navigation = resolveManagementNavigation(
        await searchParams,
        "/next_panel/tournament-team-players",
        "Back to Tournament Team Players"
    );

    return (
        <div className="container-fluid">
            <div className="row g-4">
                <div className="col-12">
                    <div className="bg-white rounded-4 shadow-sm p-4 mb-4">
                        <Link href={navigation.href} className="btn btn-sm btn-outline-secondary mb-3">
                            <ArrowLeft size={16} className="me-2" /> {navigation.label}
                        </Link>
                        <h1 className="h4 mb-0">Create Tournament Player</h1>
                        <p className="text-muted mb-0">Add a player to a tournament team. A fee record is created automatically.</p>
                    </div>
                </div>

                <div className="col-12">
                    <div className="bg-white rounded-4 shadow-sm p-4">
                        <TournamentTeamPlayerForm returnTo={navigation.href} />
                    </div>
                </div>
            </div>
        </div>
    );
}
