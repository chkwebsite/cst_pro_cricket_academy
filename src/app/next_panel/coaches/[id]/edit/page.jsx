import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import CoachForm from "../../CoachForm";

export default async function EditCoachPage({ params }) {
    const { id } = await params;

    return (
        <div className="container-fluid py-4">
            <div className="bg-white rounded-4 shadow-sm p-4 mb-4">
                <Link
                    href="/next_panel/coaches"
                    className="btn btn-sm btn-outline-secondary mb-3 d-inline-flex align-items-center gap-1"
                >
                    <ArrowLeft size={16} /> Back to Coaches
                </Link>
                <h1 className="h4 fw-bold mb-1">Edit Coach Profile</h1>
                <p className="text-muted small mb-0">
                    Update coach details, specializations, qualifications, and biography.
                </p>
            </div>
            <CoachForm id={id} />
        </div>
    );
}
