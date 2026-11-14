import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import GroundForm from "../GroundForm";
import { getNextGroundCode } from "@/app/components/lib/grounds";
import { getAuthUser } from "@/app/components/lib/rbac";

export default async function GroundNew() {
    let initialGroundCode = "GD-CODE-001";
    let loggedInAcademyId = null;

    try {
        const authUser = await getAuthUser();
        if (authUser && !authUser.isSuperAdmin && authUser.academy_id) {
            loggedInAcademyId = authUser.academy_id;
        }

        const nextInfo = await getNextGroundCode({ academyId: loggedInAcademyId });
        if (nextInfo && nextInfo.next_ground_code) {
            initialGroundCode = nextInfo.next_ground_code;
        }
    } catch (err) {
        console.error("Error loading next ground code:", err);
    }

    return (
        <div className="container-fluid">
            <div className="row g-4">
                <div className="col-12">
                    <div className="bg-white rounded-4 shadow-sm p-4 mb-4">
                        <Link href="/next_panel/grounds" className="btn btn-sm btn-outline-secondary mb-3">
                            <ArrowLeft size={16} className="me-2" /> Back to Grounds
                        </Link>
                        <h1 className="h4 mb-0">Create Ground</h1>
                        <p className="text-muted mb-0">Add a new ground.</p>
                    </div>
                </div>

                <div className="col-12">
                    <div className="bg-white rounded-4 shadow-sm p-4">
                        <GroundForm
                            initialGroundCode={initialGroundCode}
                            defaultAcademyId={loggedInAcademyId ? String(loggedInAcademyId) : ""}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
