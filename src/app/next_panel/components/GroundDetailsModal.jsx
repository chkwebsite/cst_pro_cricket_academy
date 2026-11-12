"use client";

import { Mail, MapPin, Phone, Trees, X } from "lucide-react";
import Image from "next/image";
import { useEffect, useState } from "react";

export default function GroundDetailsModal({ groundId, onClose }) {
    const [ground, setGround] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        if (!groundId) return;

        const controller = new AbortController();
        const loadGround = async () => {
            try {
                setLoading(true);
                setError("");
                const res = await fetch(`/api/ground/${groundId}`, { signal: controller.signal });
                const result = await res.json();
                if (!res.ok || !result.success) throw new Error(result.message || "Unable to load ground details");
                setGround(result.data);
            } catch (err) {
                if (err.name !== "AbortError") setError(err.message);
            } finally {
                if (!controller.signal.aborted) setLoading(false);
            }
        };

        loadGround();
        return () => controller.abort();
    }, [groundId]);

    if (!groundId) return null;

    const facilities = String(ground?.ground_facility || "")
        .split(",")
        .map((facility) => facility.trim())
        .filter(Boolean);

    return (
        <>
            <div className="modal d-block" role="dialog" aria-modal="true" aria-labelledby="ground-details-title" onClick={onClose}>
                <div className="modal-dialog modal-dialog-centered modal-dialog-scrollable modal-lg" onClick={(event) => event.stopPropagation()}>
                    <div className="modal-content">
                        <div className="modal-header">
                            <div>
                                <h2 className="modal-title h5 mb-1" id="ground-details-title">Ground Details</h2>
                                {ground && <div className="small text-muted">{ground.ground_name} {ground.ground_code ? `(${ground.ground_code})` : ""}</div>}
                            </div>
                            <button type="button" className="btn-close" aria-label="Close ground details" onClick={onClose} />
                        </div>
                        <div className="modal-body">
                            {loading ? (
                                <div className="text-center py-5 text-muted">Loading ground details...</div>
                            ) : error ? (
                                <div className="alert alert-danger mb-0" role="alert">{error}</div>
                            ) : ground && (
                                <>
                                    <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
                                        <div className="d-flex align-items-center gap-2">
                                            <Trees size={20} className="text-success" />
                                            <h3 className="h5 mb-0">{ground.ground_name}</h3>
                                        </div>
                                        <span className={`badge ${Number(ground.status) === 1 ? "bg-success" : "bg-secondary"}`}>
                                            {Number(ground.status) === 1 ? "Active" : "Inactive"}
                                        </span>
                                    </div>

                                    {ground.images?.length > 0 && (
                                        <div className="row g-2 mb-4">
                                            {ground.images.map((image) => (
                                                <div key={image.id} className="col-6 col-md-4">
                                                    <Image
                                                        src={image.ground_image}
                                                        alt={ground.ground_name}
                                                        width={640}
                                                        height={360}
                                                        unoptimized
                                                        className="img-fluid w-100 rounded border"
                                                        style={{ height: 150, objectFit: "cover" }}
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    <div className="row g-3">
                                        <div className="col-sm-6">
                                            <div className="small text-muted">Ground Code</div>
                                            <div className="fw-semibold">{ground.ground_code || "—"}</div>
                                        </div>
                                        <div className="col-sm-6">
                                            <div className="small text-muted">Academy / Branch</div>
                                            <div className="fw-semibold">{ground.academy_name || "—"} / {ground.branch_name || "—"}</div>
                                        </div>
                                        <div className="col-sm-6">
                                            <div className="small text-muted">Contact Person</div>
                                            <div className="fw-semibold">{ground.contact_person || "—"}</div>
                                        </div>
                                        <div className="col-sm-6">
                                            <div className="small text-muted">Contact</div>
                                            <div className="d-flex flex-column gap-1">
                                                {ground.phone && <span><Phone size={14} className="me-2" />{ground.phone}</span>}
                                                {ground.email && <span><Mail size={14} className="me-2" />{ground.email}</span>}
                                                {!ground.phone && !ground.email && "—"}
                                            </div>
                                        </div>
                                        <div className="col-12">
                                            <div className="small text-muted">Address</div>
                                            <div><MapPin size={14} className="me-2 text-muted" />{ground.address || "—"}</div>
                                        </div>
                                        <div className="col-12">
                                            <div className="small text-muted">Facilities</div>
                                            {facilities.length ? (
                                                <div className="d-flex flex-wrap gap-2 mt-1">
                                                    {facilities.map((facility) => <span key={facility} className="badge text-bg-light border">{facility}</span>)}
                                                </div>
                                            ) : <div>—</div>}
                                        </div>
                                        {ground.description && (
                                            <div className="col-12">
                                                <div className="small text-muted">Description</div>
                                                <div>{ground.description}</div>
                                            </div>
                                        )}
                                    </div>
                                </>
                            )}
                        </div>
                        <div className="modal-footer">
                            <button type="button" className="btn btn-secondary" onClick={onClose}><X size={16} className="me-1" />Close</button>
                        </div>
                    </div>
                </div>
            </div>
            <div className="modal-backdrop show" onClick={onClose} />
        </>
    );
}