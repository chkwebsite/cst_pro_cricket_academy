"use client";

import { useParams } from "next/navigation";
import BatchCoachForm from "../../BatchCoachForm";

export default function EditBatchCoachPage() {
    const params = useParams();
    const id = params?.id;

    return (
        <div className="container-fluid py-4">
            <div className="row justify-content-center">
                <div className="col-12 col-xl-9">
                    <BatchCoachForm id={id} />
                </div>
            </div>
        </div>
    );
}
