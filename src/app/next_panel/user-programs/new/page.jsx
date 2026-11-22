"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Plus } from "lucide-react";
import UserProgramForm, { getEmptyUserProgram, buildUserProgramPayload } from "../UserProgramForm";

async function readJson(res) {
    const text = await res.text();
    if (!text) return {};
    try {
        return JSON.parse(text);
    } catch {
        return { message: text };
    }
}

export default function NewUserProgramPage() {
    const [values, setValues] = useState(getEmptyUserProgram());
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);
    const [fieldErrors, setFieldErrors] = useState({});

    const router = useRouter();

    const handleValuesChange = (newValues) => {
        setFieldErrors((prev) => {
            const next = { ...prev };
            if (newValues.admission_players_id && next.admission_players_id) delete next.admission_players_id;
            if (newValues.program_id && next.program_id) delete next.program_id;
            if (newValues.branch_id && next.branch_id) delete next.branch_id;
            return next;
        });
        setValues(newValues);
    };

    const handleBlur = (field) => () => {
        if (field === "admission_players_id" && !values.admission_players_id) {
            setFieldErrors((prev) => ({ ...prev, admission_players_id: "Please select an admission player." }));
        }
        if (field === "program_id" && !values.program_id) {
            setFieldErrors((prev) => ({ ...prev, program_id: "Please select a program." }));
        }
        if (field === "branch_id" && !values.branch_id) {
            setFieldErrors((prev) => ({ ...prev, branch_id: "Please select a branch." }));
        }
    };

    const submit = async (e) => {
        e.preventDefault();

        const errs = {};
        if (!values.admission_players_id) errs.admission_players_id = "Please select an admission player.";
        if (!values.program_id) errs.program_id = "Please select a program.";
        if (!values.branch_id) errs.branch_id = "Please select a branch.";

        if (Object.keys(errs).length > 0) {
            setFieldErrors(errs);
            const firstKey = Object.keys(errs)[0];
            const el = document.querySelector(`[name="${firstKey}"]`);
            if (el) {
                el.focus();
                el.scrollIntoView({ behavior: "smooth", block: "center" });
            }
            return;
        }

        setSaving(true);
        setError(null);
        setFieldErrors({});

        try {
            const res = await fetch("/api/user-programs", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(buildUserProgramPayload(values)),
            });

            const json = await readJson(res);
            if (!res.ok) {
                if (json.errors) {
                    setFieldErrors(json.errors);
                    const firstKey = Object.keys(json.errors)[0];
                    const el = document.querySelector(`[name="${firstKey}"]`);
                    if (el) {
                        el.focus();
                        el.scrollIntoView({ behavior: "smooth", block: "center" });
                    }
                }
                throw new Error(json.message || "Unable to create user program.");
            }

            router.push("/next_panel/user-programs");
        } catch (e) {
            setError(e.message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="container-fluid">
            <div className="row g-4">
                <div className="col-12">
                    <div className="bg-white rounded-4 shadow-sm p-4 mb-4 d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3">
                        <div>
                            <Link href="/next_panel/user-programs" className="btn btn-sm btn-outline-secondary mb-3">
                                <ArrowLeft size={16} className="me-2" /> Back
                            </Link>
                            <h1 className="h4 mb-2">Create User Program</h1>
                            <p className="text-muted mb-0">Assign a program to an admission player.</p>
                        </div>
                        <button className="btn btn-primary" type="submit" form="userProgramForm" disabled={saving}>
                            <Plus size={16} className="me-2" />
                            {saving ? "Saving..." : "Save User Program"}
                        </button>
                    </div>
                </div>

                <div className="col-12">
                    <div className="bg-white rounded-4 shadow-sm p-4">
                        <UserProgramForm
                            formId="userProgramForm"
                            values={values}
                            onChange={handleValuesChange}
                            onSubmit={submit}
                            error={error}
                            fieldErrors={fieldErrors}
                            onBlur={handleBlur}
                            loading={saving}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
