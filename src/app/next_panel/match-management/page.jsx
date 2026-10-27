import {
    Activity,
    ClipboardList,
    Layers,
    Shield,
    Swords,
    Trophy,
    Users,
} from "lucide-react";
import ManagementHub from "../components/ManagementHub";

const sections = [
    {
        title: "Matches",
        description: "Schedule matches and maintain venues, dates, and match status.",
        href: "/next_panel/matches",
        createHref: "/next_panel/matches/new",
        Icon: Swords,
    },
    {
        title: "Teams",
        description: "Create and manage academy teams.",
        href: "/next_panel/teams",
        createHref: "/next_panel/teams/new",
        Icon: Shield,
    },
    {
        title: "Team Players",
        description: "Manage player registrations and team membership.",
        href: "/next_panel/team-players",
        createHref: "/next_panel/team-players/new",
        Icon: Users,
    },
    {
        title: "Match Players",
        description: "Select squads and manage player roles for each match.",
        href: "/next_panel/match-players",
        createHref: "/next_panel/match-players/new",
        Icon: ClipboardList,
    },
    {
        title: "Match Innings",
        description: "Create and track match innings, team totals, overs, wickets, and extras.",
        href: "/next_panel/match-innings",
        createHref: "/next_panel/match-innings/new",
        Icon: Layers,
    },
    {
        title: "Batting Scorecard",
        description: "Record player batting scores, balls, boundaries, dismissals, and strike rates.",
        href: "/next_panel/match-scorecard",
        createHref: "/next_panel/match-scorecard/new",
        Icon: Trophy,
    },
    {
        title: "Bowling Scorecard",
        description: "Record bowling figures, overs, maidens, runs conceded, wickets, and economy.",
        href: "/next_panel/match-bowling-scorecard",
        createHref: "/next_panel/match-bowling-scorecard/new",
        Icon: Activity,
    },
    {
        title: "Match Scorecard Center",
        description: "Unified live scorecard view with innings tabs, batting, bowling, and auto-sync.",
        href: "/next_panel/match-scorecard/center",
        createHref: "/next_panel/match-innings/new",
        Icon: Trophy,
    },
];

export default function MatchManagementPage() {
    return (
        <ManagementHub
            title="Match Management"
            description="Manage matches, teams, team rosters, match squads, innings, and full scorecards."
            activeHref="/next_panel/match-management"
            sections={sections}
        />
    );
}
