import { Award, BarChart3, Layers, Shield, Swords, Trophy, Users } from "lucide-react";
import ManagementHub from "../components/ManagementHub";

const sections = [
    {
        title: "Tournaments",
        description: "Create and manage tournament details, formats, and registrations.",
        href: "/next_panel/tournaments",
        createHref: "/next_panel/tournaments/new",
        Icon: Trophy,
    },
    {
        title: "Tournament Teams & Groups",
        description: "Manage registered teams, fee statuses, and Group / Pool assignments.",
        href: "/next_panel/tournament-teams",
        createHref: "/next_panel/tournament-teams/new",
        Icon: Shield,
    },
    {
        title: "Tournament Team Players",
        description: "Manage player rosters and squad members for tournament teams.",
        href: "/next_panel/tournament-team-players",
        createHref: "/next_panel/tournament-team-players/new",
        Icon: Users,
    },
    {
        title: "Tournament Matches & Fixtures",
        description: "Build tournament fixtures, schedule rounds, and assign grounds.",
        href: "/next_panel/tournament-matches",
        createHref: "/next_panel/tournament-matches/new",
        Icon: Swords,
    },
    {
        title: "Points Table & Standings",
        description: "View team scores, points, Net Run Rate (NRR), and Group standings.",
        href: "/next_panel/tournament-standings",
        manageLabel: "View Standings",
        Icon: BarChart3,
    },
    {
        title: "Match Results & Win List",
        description: "Track match winners, winning margins, innings scores, and leaderboards.",
        href: "/next_panel/tournament-results",
        manageLabel: "View Win List",
        createHref: "/next_panel/tournament-matches",
        createLabel: "Record Scores",
        Icon: Award,
    },
];

export default function TournamentManagementPage() {
    return (
        <ManagementHub
            title="Tournament Management System"
            description="Complete cricket tournament lifecycle: teams, group allocations, fixtures, live team scores, standings, and match win lists."
            activeHref="/next_panel/tournament-management"
            sections={sections}
        />
    );
}