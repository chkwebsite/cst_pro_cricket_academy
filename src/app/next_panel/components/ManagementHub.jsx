import Link from "next/link";
import { ArrowRight, Plus } from "lucide-react";

const MANAGEMENT_PAGES = [
    { href: "/next_panel/match-management", label: "Match Management" },
    { href: "/next_panel/tournament-management", label: "Tournament Management" },
];

export default function ManagementHub({ title, description, activeHref, sections }) {
    return (
        <div className="container-fluid">
            <div className="bg-white rounded-3 shadow-sm p-4 mb-4">
                <div className="d-flex flex-wrap justify-content-between align-items-center gap-3">
                    <div>
                        <h1 className="h3 mb-1">{title}</h1>
                        <p className="text-muted mb-0">{description}</p>
                    </div>
                    <nav className="nav nav-pills" aria-label="Management sections">
                        {MANAGEMENT_PAGES.map((page) => (
                            <Link
                                key={page.href}
                                href={page.href}
                                className={`nav-link ${activeHref === page.href ? "active" : ""}`}
                                aria-current={activeHref === page.href ? "page" : undefined}
                            >
                                {page.label}
                            </Link>
                        ))}
                    </nav>
                </div>
            </div>

            <div className="row g-3">
                {sections.map(({ title: sectionTitle, description: sectionDescription, href, createHref, Icon }) => (
                    <div className="col-sm-6 col-xl-3" key={sectionTitle}>
                        <section className="bg-white border rounded-3 shadow-sm p-4 h-100 d-flex flex-column">
                            <div className="d-flex align-items-center gap-3 mb-3">
                                <span className="d-inline-flex align-items-center justify-content-center rounded-2 bg-light text-primary p-2">
                                    <Icon size={22} aria-hidden="true" />
                                </span>
                                <h2 className="h5 mb-0">{sectionTitle}</h2>
                            </div>
                            <p className="text-muted mb-4">{sectionDescription}</p>
                            <div className="d-flex gap-2 mt-auto">
                                <Link href={href} className="btn btn-outline-primary btn-sm flex-fill">
                                    Manage <ArrowRight size={15} className="ms-1" />
                                </Link>
                                <Link
                                    href={`${createHref}?returnTo=${encodeURIComponent(activeHref)}`}
                                    className="btn btn-primary btn-sm flex-fill"
                                >
                                    <Plus size={15} className="me-1" /> Create
                                </Link>
                            </div>
                        </section>
                    </div>
                ))}
            </div>
        </div>
    );
}