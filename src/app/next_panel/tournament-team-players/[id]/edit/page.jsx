import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import TournamentTeamPlayerForm from "../../TournamentTeamPlayerForm";

export default async function TournamentTeamPlayerEdit({ params }) {
    const { id } = await params;
    return (
        <div className="container-fluid">
            <div className="row g-4">
                <div className="col-12">
                    <div className="bg-white rounded-4 shadow-sm p-4 mb-4">
                        <Link href="/next_panel/tournament-team-players" className="btn btn-sm btn-outline-secondary mb-3">
                            <ArrowLeft size={16} className="me-2" /> Back to Tournament Team Players
                        </Link>
                        <h1 className="h4 mb-0">Edit Tournament Player</h1>
                        <p className="text-muted mb-0">Update player details. The linked fee record is kept in sync.</p>
                    </div>
                </div>
                <div className="col-sm-12">
                    <TournamentTeamPlayerForm id={id} />
                </div>
            </div>
        </div>
    );
}
