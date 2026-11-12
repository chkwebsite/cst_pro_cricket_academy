"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import BatchCoachForm from "../BatchCoachForm";

function NewBatchCoachContent() {
    const searchParams = useSearchParams();
    const batchIdParam = searchParams.get("batch_id") || "";

    return (
        <div className="container-fluid py-4">
            <div className="row justify-content-center">
                <div className="col-12 col-xl-9">
                    <BatchCoachForm initialBatchId={batchIdParam} />
                </div>
            </div>
        </div>
    );
}

export default function NewBatchCoachPage() {
    return (
        <Suspense fallback={<div className="p-5 text-center">Loading coach assignment form...</div>}>
            <NewBatchCoachContent />
        </Suspense>
    );
}
