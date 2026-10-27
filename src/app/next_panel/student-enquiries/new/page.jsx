import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import StudentEnquiryForm from "../StudentEnquiryForm";

export default function StudentEnquiryNew() {
    return (
        <div className="container-fluid">
            <div className="row g-4">
                <div className="col-12">
                    <div className="bg-white rounded-4 shadow-sm p-4 mb-4">
                        <Link href="/next_panel/student-enquiries" className="btn btn-sm btn-outline-secondary mb-3">
                            <ArrowLeft size={16} className="me-2" /> Back to Student Enquiries
                        </Link>
                        <h1 className="h4 mb-0">Add Student Enquiry</h1>
                        <p className="text-muted mb-0">Record a phone lead, walk-in enquiry or student trial request.</p>
                    </div>
                </div>
                <div className="col-12">
                    <div className="bg-white rounded-4 shadow-sm p-4">
                        <Suspense fallback={<div className="text-center py-4">Loading form...</div>}>
                            <StudentEnquiryForm />
                        </Suspense>
                    </div>
                </div>
            </div>
        </div>
    );
}
