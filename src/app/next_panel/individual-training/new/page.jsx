"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import IndividualTrainingForm from "../IndividualTrainingForm";

function NewIndividualTrainingContent() {
    const searchParams = useSearchParams();
    const initialUserProgramId = searchParams.get("user_program_id") || "";
    const initialCoachId = searchParams.get("coach_id") || "";

    return (
        <div className="container-fluid py-4">
            <IndividualTrainingForm
                initialUserProgramId={initialUserProgramId}
                initialCoachId={initialCoachId}
            />
        </div>
    );
}

export default function NewIndividualTrainingPage() {
    return (
        <Suspense
            fallback={
                <div className="container-fluid py-5 text-center">
                    <div className="spinner-border text-primary" role="status" />
                    <div className="text-muted mt-2">Loading session form...</div>
                </div>
            }
        >
            <NewIndividualTrainingContent />
        </Suspense>
    );
}
