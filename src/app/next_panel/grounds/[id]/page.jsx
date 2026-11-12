import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Edit, MapPin, Phone, Trees } from "lucide-react";
import pool from "@/app/components/lib/db";

export default async function GroundDetailPage({ params }) {
    const { id } = await params;

    const connection = await pool.getConnection();

    let ground = null;
    let images = [];

    try {
        const [rows] = await connection.query(
            `
            SELECT
                g.id,
                g.academy_id,
                a.academy_name,
                g.branch_id,
                b.branch_name,
                g.ground_name,
                g.ground_code,
                g.contact_person,
                g.phone,
                g.email,
                g.address,
                g.description,
                g.ground_facility,
                g.status,
                g.created_at,
                g.updated_at
            FROM cst_ground g
            LEFT JOIN cst_academy a ON a.id = g.academy_id
            LEFT JOIN cst_branch b ON b.id = g.branch_id
            WHERE g.id = ?
            AND g.is_deleted = 0
            LIMIT 1
            `,
            [id]
        );

        if (!rows.length) {
            notFound();
        }

        ground = rows[0];

        const [imageRows] = await connection.query(
            `
            SELECT
                id,
                ground_image,
                is_primary,
                status
            FROM cst_ground_images
            WHERE ground_id = ?
            AND status = 1
            ORDER BY is_primary DESC, id DESC
            `,
            [id]
        );

        images = imageRows || [];
    } catch (error) {
        console.error("GROUND DETAIL ERROR:", error);
        throw new Error("Failed to load ground details");
    } finally {
        connection.release();
    }

    const facilities = (value) =>
        (value || "")
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean);

    return (
        <div className="container-fluid">
            <div className="row g-4">
                <div className="col-12">
                    <div className="bg-white rounded-4 shadow-sm p-4 mb-4">
                        <Link href="/next_panel/grounds" className="btn btn-sm btn-outline-secondary mb-3">
                            <ArrowLeft size={16} className="me-2" /> Back to Grounds
                        </Link>
                        <div className="d-flex flex-wrap justify-content-between align-items-center gap-3">
                            <div>
                                <div className="d-flex align-items-center gap-2 mb-1">
                                    <Trees size={22} />
                                    <h1 className="h4 mb-0">Ground Details</h1>
                                </div>
                                <p className="text-muted mb-0">{ground.ground_name} ({ground.ground_code})</p>
                            </div>
                            <Link
                                href={`/next_panel/grounds/${ground.id}/edit`}
                                className="btn btn-primary"
                            >
                                <Edit size={16} className="me-2" /> Edit ground
                            </Link>
                        </div>
                    </div>
                </div>

                {images.length > 0 && (
                    <div className="col-12">
                        <div className="bg-white rounded-4 shadow-sm p-4">
                            <h2 className="h6 mb-3">Ground Images</h2>
                            <div className="row g-3">
                                {images.map((img) => (
                                    <div key={img.id} className="col-12 col-sm-6 col-md-4 col-lg-3">
                                        <div className="border rounded-3 overflow-hidden bg-light">
                                            <img
                                                src={img.ground_image}
                                                alt={ground.ground_name}
                                                className="img-fluid w-100"
                                                style={{ height: 180, objectFit: "cover" }}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                <div className="col-lg-6">
                    <div className="bg-white rounded-4 shadow-sm p-4">
                        <h2 className="h6 mb-3">Ground Info</h2>
                        <div className="row g-3">
                            <div className="col-md-6">
                                <label className="text-muted small">Academy</label>
                                <div className="fw-semibold">{ground.academy_name || "—"}</div>
                            </div>
                            <div className="col-md-6">
                                <label className="text-muted small">Branch</label>
                                <div className="fw-semibold">{ground.branch_name || "—"}</div>
                            </div>
                            <div className="col-md-6">
                                <label className="text-muted small">Code</label>
                                <div className="fw-semibold">{ground.ground_code || "—"}</div>
                            </div>
                            <div className="col-md-6">
                                <label className="text-muted small">Status</label>
                                <div>
                                    <span className={`badge ${Number(ground.status) === 1 ? "bg-success" : "bg-secondary"}`}>
                                        {Number(ground.status) === 1 ? "Active" : "Inactive"}
                                    </span>
                                </div>
                            </div>
                            <div className="col-md-6">
                                <label className="text-muted small">Contact Person</label>
                                <div className="fw-semibold">{ground.contact_person || "—"}</div>
                            </div>
                            <div className="col-md-6">
                                <label className="text-muted small">Phone</label>
                                <div className="fw-semibold">{ground.phone || "—"}</div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="col-lg-6">
                    <div className="bg-white rounded-4 shadow-sm p-4 h-100">
                        <h2 className="h6 mb-3">Location & Facilities</h2>
                        <div className="d-flex align-items-start gap-2 mb-3">
                            <MapPin size={16} className="text-muted mt-1" />
                            <div>{ground.address || "—"}</div>
                        </div>

                        {ground.email && (
                            <div className="d-flex align-items-center gap-2 mb-3">
                                <Phone size={16} className="text-muted" />
                                <span>{ground.email}</span>
                            </div>
                        )}

                        <label className="text-muted small">Facilities</label>
                        <div className="d-flex flex-wrap gap-2 mt-2">
                            {facilities(ground.ground_facility).length === 0 ? (
                                <span className="text-muted">No facilities listed</span>
                            ) : (
                                facilities(ground.ground_facility).map((facility, index) => (
                                    <span key={`${facility}-${index}`} className="badge text-bg-light border">
                                        {facility}
                                    </span>
                                ))
                            )}
                        </div>

                        {ground.description && (
                            <div className="mt-4">
                                <label className="text-muted small">Description</label>
                                <p className="mb-0 mt-2">{ground.description}</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
