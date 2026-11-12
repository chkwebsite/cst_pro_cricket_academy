"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import PlayerPaymentForm from "../PlayerPaymentForm";

function NewPaymentContent() {
    const searchParams = useSearchParams();
    const defaultFeeId = searchParams.get("player_program_fee_id");
    const userProgramId = searchParams.get("user_program_id");
    const feeMonth = searchParams.get("fee_month");
    const amount = searchParams.get("amount");
    const from = searchParams.get("from");

    return (
        <PlayerPaymentForm
            defaultFeeId={defaultFeeId}
            userProgramId={userProgramId}
            feeMonth={feeMonth}
            initialAmount={amount}
            from={from}
        />
    );
}

export default function NewPaymentPage() {
    return (
        <div className="container-fluid py-4">
            <Suspense
                fallback={
                    <div className="text-center py-5">
                        <div className="spinner-border text-primary" role="status" />
                    </div>
                }
            >
                <NewPaymentContent />
            </Suspense>
        </div>
    );
}
