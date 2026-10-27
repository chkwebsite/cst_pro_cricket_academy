import Link from "next/link";

export default function Footer({
  academyName = "ST Cricket Academy",
  tagline = "Professional cricket coaching for every age and level. Train hard, play smart, love the game.",
  address = "Sports Complex, Your City",
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
          <div className="col-lg-4">
            <h5>{academyName}</h5>
            <p>{tagline}</p>
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

          <div className="col-6 col-lg-2">
            <h5>Quick Links</h5>
            <ul>
              <li>
                <Link href="/">Home</Link>
              </li>
              <li>
                <Link href="/about">About</Link>
              </li>
              <li>
                <Link href="/programs">Programs</Link>
              </li>
              <li>
                <Link href="/coaches">Coaches</Link>
              </li>
              <li>
                <Link href="/gallery">Gallery</Link>
              </li>
              <li>
                <Link href="/ground-booking">Ground Booking</Link>
              </li>
              <li>
                <Link href="/rules">Rules &amp; Regulations</Link>
              </li>
            </ul>
          </div>

          <div className="col-6 col-lg-3">
            <h5>Programs</h5>
            <ul>
              <li>
                <Link href="/programs">One-on-One</Link>
              </li>
              <li>
                <Link href="/programs">Small Group</Link>
              </li>
              <li>
                <Link href="/programs">Mini Camp</Link>
              </li>
              <li>
                <Link href="/programs">Residential</Link>
              </li>
            </ul>
          </div>

          <div className="col-lg-3">
            <h5>Contact</h5>
            <ul>
              <li>
                <i className="bi bi-geo-alt-fill me-2"></i>
                {address}
              </li>
              <li>
                <i className="bi bi-telephone-fill me-2"></i>
                <a href={`tel:${phone.replace(/[^0-9+]/g, "")}`}>{phone}</a>
              </li>
              <li>
                <i className="bi bi-envelope-fill me-2"></i>
                <a href={`mailto:${email}`}>{email}</a>
              </li>
            </ul>
          </div>
        </div>

        <div className="footer-bottom d-flex flex-wrap justify-content-between gap-2">
          <span>&copy; {year} {academyName}. All rights reserved.</span>
          <span>Sample website template</span>
        </div>
      </div>
    </footer>
  );
}
