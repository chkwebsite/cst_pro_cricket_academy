import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import GroundImageForm from "../GroundImageForm";

export default async function GroundImageNew({ searchParams }) {
    const { ground_id } = await searchParams;

    return (
        <div className="container-fluid">
            <div className="row g-4">
                <div className="col-12">
                    <div className="bg-white rounded-4 shadow-sm p-4 mb-4">
                        <Link href="/next_panel/ground-images" className="btn btn-sm btn-outline-secondary mb-3">
                            <ArrowLeft size={16} className="me-2" /> Back to Ground Images
                        </Link>
                        <h1 className="h4 mb-0">Upload Ground Images</h1>
                        <p className="text-muted mb-0">Select a ground and upload one or more images.</p>
                    </div>
                </div>

                <div className="col-12">
                    <GroundImageForm defaultGroundId={ground_id || ""} />
                </div>
            </div>
        </div>
    );
}
