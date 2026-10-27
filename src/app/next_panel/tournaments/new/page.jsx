import TournamentForm from "../TournamentForm";
import { resolveManagementNavigation } from "../../components/managementNavigation";

export default async function NewTournamentPage({ searchParams }) {
    const navigation = resolveManagementNavigation(
        await searchParams,
        "/next_panel/tournaments",
        "Back to tournaments"
    );

    return <TournamentForm returnTo={navigation.href} returnLabel={navigation.label} />;
}
