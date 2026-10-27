import { Shield, Swords, Trophy, Users } from "lucide-react";
import ManagementHub from "../components/ManagementHub";

const sections = [
    {
        title: "Tournaments",
        description: "Create and manage tournament details and registrations.",
        href: "/next_panel/tournaments",
        createHref: "/next_panel/tournaments/new",
        Icon: Trophy,
    },
    {
        title: "Tournament Teams",
        description: "Manage the teams registered for each tournament.",
        href: "/next_panel/tournament-teams",
        createHref: "/next_panel/tournament-teams/new",
        Icon: Shield,
    },
    {
        title: "Tournament Team Players",
        description: "Manage player rosters for tournament teams.",
        href: "/next_panel/tournament-team-players",
        createHref: "/next_panel/tournament-team-players/new",
        Icon: Users,
    },
    {
        title: "Tournament Matches",
        description: "Build tournament fixtures and track match results.",
        href: "/next_panel/tournament-matches",
        createHref: "/next_panel/tournament-matches/new",
        Icon: Swords,
    },
];

export default function TournamentManagementPage() {
    return (
        <ManagementHub
            title="Tournament Management"
            description="Manage tournaments, registered teams, player rosters, and fixtures."
            activeHref="/next_panel/tournament-management"
            sections={sections}
        />
    );
}