import Link from "next/link";
import { ArrowLeft, Home, Package, Trophy, Calendar } from "lucide-react";

export const metadata = {
    title: "Page Not Found (404) | CST Cricket Academy",
    description: "The page you are looking for does not exist.",
};

export default function NotFound() {
    return (
        <div
            className="d-flex align-items-center justify-content-center text-center px-3"
            style={{
                minHeight: "100vh",
                background: "linear-gradient(135deg, #062f38 0%, #0a3d47 100%)",
            }}
        >
            <div className="card border-0 rounded-4 shadow-lg p-4 p-md-5 bg-white" style={{ maxWidth: "560px" }}>
                {/* 404 Visual */}
                <div
                    className="fw-bold font-oswald text-uppercase display-1 mb-0"
                    style={{ color: "#062f38", letterSpacing: "2px" }}
                >
                    404
                </div>
                <div
                    className="badge mx-auto px-3 py-1 mb-3 fw-bold text-uppercase"
                    style={{ background: "#ffeb3b", color: "#062f38" }}
                >
                    HOWZAT! Clean Bowled!
                </div>

                <h3 className="fw-bold text-dark font-oswald text-uppercase mb-2">
                    Page Out Of The Ground
                </h3>
                <p className="text-muted small mb-4" style={{ lineHeight: "1.6" }}>
                    The page you are searching for might have been removed, had its name changed, or was mistyped. Let&apos;s get you back on the pitch!
                </p>

                {/* Quick Navigation Buttons */}
                <div className="d-flex flex-column flex-sm-row justify-content-center gap-2 mb-4">
                    <Link
                        href="/"
                        className="btn btn-dark rounded-pill px-4 py-2.5 fw-semibold d-inline-flex align-items-center justify-content-center gap-2"
                        style={{ background: "#062f38" }}
                    >
                        <Home size={16} /> Back to Home
                    </Link>
                    <Link
                        href="/shop"
                        className="btn btn-outline-success rounded-pill px-4 py-2.5 fw-semibold d-inline-flex align-items-center justify-content-center gap-2"
                    >
                        <Package size={16} /> Pro Store
                    </Link>
                </div>

                {/* Popular Destinations */}
                <div className="pt-3 border-top">
                    <div className="extra-small text-muted text-uppercase fw-bold mb-2">
                        Popular Academy Links
                    </div>
                    <div className="d-flex justify-content-center flex-wrap gap-3 small">
                        <Link href="/programs" className="text-decoration-none text-secondary hover-teal">
                            Programs
                        </Link>
                        <span>•</span>
                        <Link href="/ground-booking" className="text-decoration-none text-secondary hover-teal">
                            Ground Booking
                        </Link>
                        <span>•</span>
                        <Link href="/tournaments" className="text-decoration-none text-secondary hover-teal">
                            Tournaments
                        </Link>
                        <span>•</span>
                        <Link href="/book-free-trial" className="text-decoration-none text-success fw-semibold">
                            Free Trial
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
