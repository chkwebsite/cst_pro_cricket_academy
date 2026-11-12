import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import TeamPlayerForm from "../TeamPlayerForm";
import { resolveManagementNavigation } from "../../components/managementNavigation";

export default async function TeamPlayerNew({ searchParams }) {
    const navigation = resolveManagementNavigation(
        await searchParams,
        "/next_panel/team-players",
        "Back to Team Players"
    );

    return (
        <div className="container-fluid">
            <div className="row g-4">
                <div className="col-12">
                    <div className="bg-white rounded-4 shadow-sm p-4 mb-4">
                        <Link href={navigation.href} className="btn btn-sm btn-outline-secondary mb-3">
                            <ArrowLeft size={16} className="me-2" /> {navigation.label}
                        </Link>
                        <h1 className="h4 mb-0">Add Player to Team</h1>
                        <p className="text-muted mb-0">Add an academy player or an outside player to a team.</p>
                    </div>
                </div>

                <div className="col-12">
                    <div className="bg-white rounded-4 shadow-sm p-4">
                        <TeamPlayerForm returnTo={navigation.href} />
                    </div>
                </div>
            </div>
        </div>
    );
}
