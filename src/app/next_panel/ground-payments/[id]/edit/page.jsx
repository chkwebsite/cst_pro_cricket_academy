import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import GroundPaymentForm from "../../GroundPaymentForm";

export default async function GroundPaymentEdit({ params }) {
    const { id } = await params;
    return (
        <div className="container-fluid">
            <div className="row g-4">
                <div className="col-12">
                    <div className="bg-white rounded-4 shadow-sm p-4 mb-4">
                        <Link href="/next_panel/ground-payments" className="btn btn-sm btn-outline-secondary mb-3">
                            <ArrowLeft size={16} className="me-2" /> Back to Ground Payments
                        </Link>
                        <h1 className="h4 mb-0">Edit Ground Payment</h1>
                        <p className="text-muted mb-0">Update payment details.</p>
                    </div>
                </div>
                <div className="col-sm-12">
                    <GroundPaymentForm id={id} />
                </div>
            </div>
        </div>
    );
}
