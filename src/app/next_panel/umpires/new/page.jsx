import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import UmpireForm from "../UmpireForm";

export default function NewUmpirePage() {
    return (
        <div className="container-fluid py-4">
            <div className="bg-white rounded-4 shadow-sm p-4 mb-4">
                <Link
                    href="/next_panel/umpires"
                    className="btn btn-sm btn-outline-secondary mb-3 d-inline-flex align-items-center gap-1"
                >
                    <ArrowLeft size={16} /> Back to Umpires
                </Link>
                <h1 className="h4 fw-bold mb-1">Add New Umpire</h1>
                <p className="text-muted small mb-0">
                    Register an official match umpire with credentials, certifications, and match format fee structures.
                </p>
            </div>
            <UmpireForm />
        </div>
    );
}
