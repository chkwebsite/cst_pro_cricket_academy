import Link from "next/link";

export default function Footer({
  academyName = "CST Cricket Academy",
  tagline = "Professional cricket coaching for every age and level. Train hard, play smart, love the game.",
  address = "Maruti Kunj Road, Gurugram, Haryana - 122002",
  phone = "+91 8285831503",
  email = "chandankeshri100@gmail.com",
  year = 2026,
  socialLinks = [
    { icon: "bi-facebook", href: "#", label: "Facebook" },
    { icon: "bi-instagram", href: "#", label: "Instagram" },
    { icon: "bi-youtube", href: "#", label: "YouTube" },
    { icon: "bi-twitter-x", href: "#", label: "X" },
  ],
}) {
  return (
    <footer>
      <div className="container">
        <div className="row g-4">
          {/* Col 1: Brand & Social */}
          <div className="col-lg-4 col-md-6">
            <h5>{academyName}</h5>
            <p>{tagline}</p>
            <div className="mb-3">
              <Link href="/book-free-trial" className="btn btn-sm btn-outline-light rounded-pill px-3 py-1.5 fw-semibold">
                <i className="bi bi-calendar-event me-1 text-lime"></i> Book a Free Trial
              </Link>
            </div>
            <div className="social">
              {socialLinks.map((item, index) => (
                <a
                  key={index}
                  href={item.href}
                  aria-label={item.label}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <i className={`bi ${item.icon}`}></i>
                </a>
              ))}
            </div>
          </div>

          {/* Col 2: Quick Links */}
          <div className="col-6 col-lg-2">
            <h5>Explore</h5>
            <ul>
              <li>
                <Link href="/about">About Us</Link>
              </li>
              <li>
                <Link href="/facilities">Facilities</Link>
              </li>
              <li>
                <Link href="/achievements">Hall of Fame</Link>
              </li>
              <li>
                <Link href="/tournaments">Tournaments</Link>
              </li>
              <li>
                <Link href="/matches">Live Matches</Link>
              </li>
              <li>
                <Link href="/shop">Pro Store</Link>
              </li>
              <li>
                <Link href="/gallery">Photo Gallery</Link>
              </li>
              <li>
                <Link href="/faq">FAQs</Link>
              </li>
            </ul>
          </div>

          {/* Col 3: Programs & Bookings */}
          <div className="col-6 col-lg-3">
            <h5>Policies &amp; Legal</h5>
            <ul>
              <li>
                <Link href="/privacy-policy">Privacy Policy</Link>
              </li>
              <li>
                <Link href="/terms-conditions">Terms &amp; Conditions</Link>
              </li>
              <li>
                <Link href="/refund-policy">Refund &amp; Cancellation</Link>
              </li>
              <li>
                <Link href="/shipping-policy">Shipping Policy</Link>
              </li>
              <li>
                <Link href="/rules">Rules &amp; Regulations</Link>
              </li>
              <li>
                <Link href="/ground-booking">Ground Booking</Link>
              </li>
              <li>
                <Link href="/my-bookings">My Slot Bookings</Link>
              </li>
            </ul>
          </div>

          {/* Col 4: Contact Information */}
          <div className="col-lg-3 col-md-6">
            <h5>Contact Academy</h5>
            <ul>
              <li>
                <i className="bi bi-geo-alt-fill me-2 text-lime"></i>
                {address}
              </li>
              <li>
                <i className="bi bi-telephone-fill me-2 text-lime"></i>
                <a href={`tel:${phone.replace(/[^0-9+]/g, "")}`}>{phone}</a>
              </li>
              <li>
                <i className="bi bi-envelope-fill me-2 text-lime"></i>
                <a href={`mailto:${email}`}>{email}</a>
              </li>
              <li className="mt-2">
                <span className="badge bg-white bg-opacity-10 text-white border border-white border-opacity-20 px-2.5 py-1">
                  Open 7 Days • 6 AM – 8 PM
                </span>
              </li>
            </ul>
          </div>
        </div>

        {/* Footer Bottom */}
        <div className="footer-bottom d-flex flex-wrap justify-content-between align-items-center gap-2 mt-4 pt-3 border-top border-white border-opacity-10 small">
          <span>&copy; {year} {academyName}. All rights reserved.</span>
          <div className="d-flex align-items-center gap-3">
            <Link href="/privacy-policy" className="text-white-50 text-decoration-none hover-white">Privacy</Link>
            <span>•</span>
            <Link href="/terms-conditions" className="text-white-50 text-decoration-none hover-white">Terms</Link>
            <span>•</span>
            <Link href="/refund-policy" className="text-white-50 text-decoration-none hover-white">Refunds</Link>
            <span>•</span>
            <Link href="/shipping-policy" className="text-white-50 text-decoration-none hover-white">Shipping</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
