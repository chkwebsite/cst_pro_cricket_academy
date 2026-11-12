import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import PermissionsForm from "../../PermissionsForm";


export default async function PermissionEdit({ params }) {
    const { id } = await params;
    return (
        <div className="container-fluid">
            <div className="row g-4">
                <div className="col-12">
                    <div className="bg-white rounded-4 shadow-sm p-4 mb-4">
                        <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-3">
                            <div>
                                <Link href="/next_panel/permissions" className="btn btn-sm btn-outline-secondary mb-3">
                                    <ArrowLeft size={16} className="me-2" /> Back to Permission
                                </Link>
                                <h1 className="h4 mb-0"> Update Permission</h1>
                                <p className="text-muted mb-0">Update Permission.</p>
                            </div>
                            {/* <button className="btn btn-primary" type="submit" form="academyForm" disabled={saving}>
                                <Plus size={16} className="me-2" /> {saving ? "Saving..." : "Save Academy"}
                            </button> */}
                        </div>
                    </div>
                </div>
                <div className="col-sm-12">
                    <PermissionsForm id={id} />
                </div>
            </div>
        </div>

    )
}
