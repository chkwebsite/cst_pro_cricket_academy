"use client";

import { useParams } from "next/navigation";
import BatchForm from "../../BatchForm";

export default function EditBatchPage() {
    const params = useParams();
    const id = params?.id;

    return (
        <div className="container-fluid py-4">
            <div className="row justify-content-center">
                <div className="col-12 col-xl-10">
                    <BatchForm id={id} />
                </div>
            </div>
        </div>
    );
}
