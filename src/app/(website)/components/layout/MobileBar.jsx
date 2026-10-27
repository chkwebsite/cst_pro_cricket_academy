import Link from "next/link";

export default function MobileBar({
  phone = "+91 8285831503",
  trialLink = "/contact",
  trialText = "Book Free Trial",
}) {
  return (
    <div className="mobile-bar d-lg-none">
      <a href={`tel:${phone.replace(/[^0-9+]/g, "")}`}>
        <i className="bi bi-telephone-fill"></i> Call
      </a>
      <Link href={trialLink} className="primary">
        <i className="bi bi-calendar-check-fill"></i> {trialText}
      </Link>
    </div>
  );
}
