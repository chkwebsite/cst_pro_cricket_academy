import Link from "next/link";

export default function Footer({
  academyName = "CST Cricket Academy",
  tagline = "Professional cricket coaching for every age and level. Train hard, play smart, love the game.",
  address = "Maruti Kunj Road, Gurugram, Haryana, 122002",
  phone = "+91 8285831503",
  email = "chandankeshri100@gmail.com",
}) {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="footer">
      <div className="container">
        <div className="footer__grid">
          {/* Brand & Social */}
          <div>
            <Link className="logo" href="/" aria-label="CST Cricket Academy home">
              <div
                style={{
                  background: "rgba(255, 255, 255, 0.96)",
                  padding: "8px 16px",
                  borderRadius: "14px",
                  display: "inline-flex",
                  alignItems: "center",
                  boxShadow: "0 4px 14px rgba(0, 0, 0, 0.15)",
                }}
              >
                <img
                  src="/images/website/CSTCricketAcademyLogo.png"
                  alt="CST Cricket Academy"
                  style={{
                    height: "44px",
                    width: "auto",
                    maxWidth: "180px",
                    objectFit: "contain",
                    display: "block",
                  }}
                />
              </div>
            </Link>
            <p className="mt-3" style={{ color: "#a9c2c0", fontSize: "14px", lineHeight: "1.7" }}>
              {tagline}
            </p>
            <div className="social mt-4">
              <a href="#" aria-label="Facebook">
                <svg viewBox="0 0 24 24"><path d="M14 8h3V4h-3a4 4 0 0 0-4 4v3H7v4h3v6h4v-6h3l1-4h-4V8z"/></svg>
              </a>
              <a href="#" aria-label="Instagram">
                <svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r=".8"/></svg>
              </a>
              <a href="#" aria-label="YouTube">
                <svg viewBox="0 0 24 24"><rect x="2" y="5" width="20" height="14" rx="4"/><path d="m10 9 5 3-5 3z"/></svg>
              </a>
              <a href="#" aria-label="X">
                <svg viewBox="0 0 24 24"><path d="M4 4l16 16M20 4 4 20"/></svg>
              </a>
            </div>
          </div>

          {/* Explore */}
          <div>
            <h4>EXPLORE</h4>
            <ul>
              <li><Link href="/about">About Us</Link></li>
              <li><Link href="/facilities">Facilities</Link></li>
              <li><Link href="/achievements">Hall of Fame</Link></li>
              <li><Link href="/tournaments">Tournaments</Link></li>
              <li><Link href="/matches">Live Matches</Link></li>
              <li><Link href="/shop">Pro Store</Link></li>
              <li><Link href="/gallery">Photo Gallery</Link></li>
            </ul>
          </div>

          {/* Policies & Legal */}
          <div>
            <h4>POLICIES &amp; LEGAL</h4>
            <ul>
              <li><Link href="/privacy-policy">Privacy Policy</Link></li>
              <li><Link href="/terms-conditions">Terms &amp; Conditions</Link></li>
              <li><Link href="/refund-policy">Refund &amp; Cancellation</Link></li>
              <li><Link href="/shipping-policy">Shipping Policy</Link></li>
              <li><Link href="/rules">Rules &amp; Regulations</Link></li>
              <li><Link href="/ground-booking">Ground Booking</Link></li>
              <li><Link href="/my-bookings">My Slot Bookings</Link></li>
            </ul>
          </div>

          {/* Contact Academy */}
          <div>
            <h4>CONTACT ACADEMY</h4>
            <ul>
              <li>{address}</li>
              <li><a href={`tel:${phone.replace(/[^0-9+]/g, "")}`}>{phone}</a></li>
              <li><a href={`mailto:${email}`}>{email}</a></li>
              <li style={{ color: "#5ee6d0" }}>Open 7 days · 6 AM – 8 PM</li>
            </ul>
          </div>
        </div>

        <div className="footer__bottom">
          <span>© {currentYear} {academyName}. All rights reserved.</span>
          <span style={{ display: "flex", gap: "20px" }}>
            <Link href="/privacy-policy">Privacy</Link>
            <Link href="/terms-conditions">Terms</Link>
            <Link href="/refund-policy">Refunds</Link>
            <Link href="/shipping-policy">Shipping</Link>
          </span>
        </div>
      </div>
    </footer>
  );
}
