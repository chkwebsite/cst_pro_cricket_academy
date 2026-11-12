import Link from "next/link";
import { ShieldAlert } from "lucide-react";

export default function NoPermissionPage() {
    return (
        <div className="container-fluid">
            <div className="row justify-content-center py-5">
                <div className="col-12 col-md-8 col-lg-6">
                    <div className="bg-white border rounded-3 shadow-sm p-5 text-center">
                        <ShieldAlert size={42} className="text-danger mb-3" aria-hidden="true" />
                        <h1 className="h3 mb-2">No permission</h1>
                        <p className="text-muted mb-4">No permission, please contact Web Administrator.</p>
                        <Link href="/next_panel/dashboard" className="btn btn-primary">
                            Back to Dashboard
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}