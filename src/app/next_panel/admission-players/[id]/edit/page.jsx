import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import AdmissionPlayerForm from "../../AdmissionPlayerForm";

export default async function AdmissionPlayerEdit({ params }) {
    const { id } = await params;
    return (
        <div className="container-fluid">
            <div className="row g-4">
                <div className="col-12">
                    <div className="bg-white rounded-4 shadow-sm p-4 mb-4">
                        <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-3">
                            <div>
                                <Link href="/next_panel/admission-players" className="btn btn-sm btn-outline-secondary mb-3">
                                    <ArrowLeft size={16} className="me-2" /> Back to Admission Players
                                </Link>
                                <h1 className="h4 mb-0">Edit Admission Player</h1>
                                <p className="text-muted mb-0">Update player details.</p>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="col-sm-12">
                    <AdmissionPlayerForm id={id} />
                </div>
            </div>
        </div>
    );
}
