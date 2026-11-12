import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import TeamForm from "../TeamForm";
import { resolveManagementNavigation } from "../../components/managementNavigation";

export default async function TeamNew({ searchParams }) {
    const navigation = resolveManagementNavigation(
        await searchParams,
        "/next_panel/teams",
        "Back to Teams"
    );

    return (
        <div className="container-fluid">
            <div className="row g-4">
                <div className="col-12">
                    <div className="bg-white rounded-4 shadow-sm p-4 mb-4">
                        <Link href={navigation.href} className="btn btn-sm btn-outline-secondary mb-3">
                            <ArrowLeft size={16} className="me-2" /> {navigation.label}
                        </Link>
                        <h1 className="h4 mb-0">Create Team</h1>
                        <p className="text-muted mb-0">Add a new team.</p>
                    </div>
                </div>

                <div className="col-12">
                    <div className="bg-white rounded-4 shadow-sm p-4">
                        <TeamForm returnTo={navigation.href} />
                    </div>
                </div>
            </div>
        </div>
    );
}
