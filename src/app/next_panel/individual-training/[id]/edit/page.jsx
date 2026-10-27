"use client";

import { useParams } from "next/navigation";
import IndividualTrainingForm from "../../IndividualTrainingForm";

export default function EditIndividualTrainingPage() {
    const params = useParams();
    const id = params?.id;

    return (
        <div className="container-fluid py-4">
            <IndividualTrainingForm id={id} />
        </div>
    );
}
