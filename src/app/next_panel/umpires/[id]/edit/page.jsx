import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import UmpireForm from "../../UmpireForm";

export default async function EditUmpirePage({ params }) {
    const { id } = await params;

    return (
        <div className="container-fluid py-4">
            <div className="bg-white rounded-4 shadow-sm p-4 mb-4">
                <Link
                    href="/next_panel/umpires"
                    className="btn btn-sm btn-outline-secondary mb-3 d-inline-flex align-items-center gap-1"
                >
                    <ArrowLeft size={16} /> Back to Umpires
                </Link>
                <h1 className="h4 fw-bold mb-1">Edit Umpire Profile</h1>
                <p className="text-muted small mb-0">
                    Update umpire profile, assigned branches, qualifications, and match format fees.
                </p>
            </div>
            <UmpireForm id={id} />
        </div>
    );
}
