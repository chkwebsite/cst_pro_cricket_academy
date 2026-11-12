import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import GroundImageForm from "../../GroundImageForm";

export default async function GroundImageEdit({ params }) {
    const { id } = await params;
    return (
        <div className="container-fluid">
            <div className="row g-4">
                <div className="col-12">
                    <div className="bg-white rounded-4 shadow-sm p-4 mb-4">
                        <Link href="/next_panel/ground-images" className="btn btn-sm btn-outline-secondary mb-3">
                            <ArrowLeft size={16} className="me-2" /> Back to Ground Images
                        </Link>
                        <h1 className="h4 mb-0">Edit Ground Image</h1>
                        <p className="text-muted mb-0">Change the ground, replace the photo, or set it as primary.</p>
                    </div>
                </div>
                <div className="col-sm-12">
                    <GroundImageForm id={id} />
                </div>
            </div>
        </div>
    );
}
