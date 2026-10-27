"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import PlayerAttendanceForm from "../PlayerAttendanceForm";

export default function NewPlayerAttendancePage() {
    return (
        <div className="container-fluid py-3">
            <div className="mb-3">
                <Link href="/next_panel/player-attendance" className="btn btn-sm btn-outline-secondary">
                    <ArrowLeft size={16} className="me-1" /> Back to Attendance List
                </Link>
            </div>
            <PlayerAttendanceForm />
        </div>
    );
}
