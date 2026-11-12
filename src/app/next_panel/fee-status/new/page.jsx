"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useUser } from "../../components/UserContext";
import FeeStatusForm from "../FeeStatusForm";

export default function FeeStatusNew() {
    const router = useRouter();
    const { user } = useUser();
    const userRole = String(user?.user_type || "").toLowerCase().replace(/[^a-z0-9]/g, "");
    const isPlayer = userRole.includes("player") || userRole === "7";

    useEffect(() => {
        if (isPlayer) {
            router.replace("/next_panel/fee-status");
        }
    }, [isPlayer, router]);

    if (isPlayer) {
        return null;
    }
    return (
        <div className="container-fluid">
            <div className="row g-4">
                <div className="col-12">
                    <div className="bg-white rounded-4 shadow-sm p-4 mb-4">
                        <Link href="/next_panel/fee-status" className="btn btn-sm btn-outline-secondary mb-3">
                            <ArrowLeft size={16} className="me-2" /> Back to Fee Status
                        </Link>
                        <h1 className="h4 mb-0">Create Fee</h1>
                        <p className="text-muted mb-0">Add a new fee record.</p>
                    </div>
                </div>

                <div className="col-12">
                    <div className="bg-white rounded-4 shadow-sm p-4">
                        <FeeStatusForm />
                    </div>
                </div>
            </div>
        </div>
    );
}
