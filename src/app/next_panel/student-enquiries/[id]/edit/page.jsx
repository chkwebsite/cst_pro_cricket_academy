import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import StudentEnquiryForm from "../../StudentEnquiryForm";

export default async function StudentEnquiryEdit({ params }) {
    const { id } = await params;

    return (
        <div className="container-fluid">
            <div className="row g-4">
                <div className="col-12">
                    <div className="bg-white rounded-4 shadow-sm p-4 mb-4">
                        <Link href="/next_panel/student-enquiries" className="btn btn-sm btn-outline-secondary mb-3">
                            <ArrowLeft size={16} className="me-2" /> Back to Student Enquiries
                        </Link>
                        <h1 className="h4 mb-0">Edit Student Enquiry #{id}</h1>
                        <p className="text-muted mb-0">Update contact info, status, assigned staff, and notes.</p>
                    </div>
                </div>
                <div className="col-12">
                    <div className="bg-white rounded-4 shadow-sm p-4">
                        <Suspense fallback={<div className="text-center py-4">Loading form...</div>}>
                            <StudentEnquiryForm id={id} />
                        </Suspense>
                    </div>
                </div>
            </div>
        </div>
    );
}
