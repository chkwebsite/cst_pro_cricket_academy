import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import jwt from "jsonwebtoken";
import FeeStatusForm from "../../FeeStatusForm";

export default async function FeeStatusEdit({ params }) {
    const { id } = await params;

    const cookieStore = await cookies();
    const token = cookieStore.get("auth_token")?.value;
    if (token) {
        try {
            const payload = jwt.decode(token);
            const rawRole = String(payload?.user_type || payload?.role || "").toLowerCase().replace(/[^a-z0-9]/g, "");
            if (rawRole.includes("player") || rawRole === "7") {
                redirect("/next_panel/fee-status");
            }
        } catch (e) {
            if (e?.digest?.startsWith?.("NEXT_REDIRECT")) throw e;
        }
    }
    return (
        <div className="container-fluid">
            <div className="row g-4">
                <div className="col-12">
                    <div className="bg-white rounded-4 shadow-sm p-4 mb-4">
                        <Link href="/next_panel/fee-status" className="btn btn-sm btn-outline-secondary mb-3">
                            <ArrowLeft size={16} className="me-2" /> Back to Fee Status
                        </Link>
                        <h1 className="h4 mb-0">Edit Fee</h1>
                        <p className="text-muted mb-0">Update fee amount, payment and status.</p>
                    </div>
                </div>
                <div className="col-sm-12">
                    <FeeStatusForm id={id} />
                </div>
            </div>
        </div>
    );
}
