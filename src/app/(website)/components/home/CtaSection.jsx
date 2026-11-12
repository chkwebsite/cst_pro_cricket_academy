import Link from "next/link";

export default function CtaSection({
  title = "YOUR CRICKET JOURNEY STARTS HERE.",
  subtitle = "Take the first step towards becoming a better cricketer. Join CST Cricket Academy today.",
  buttonText = "Book Free Trial",
  buttonLink = "/book-free-trial",
  contactText = "Contact Us",
  contactLink = "/contact",
}) {
  return (
    <section className="section" id="cta">
      <div className="container">
        <div className="cta" data-reveal="zoom">
          <h2 className="title">
            {title.includes("JOURNEY") ? (
              <>
                YOUR CRICKET JOURNEY<br />STARTS HERE.
              </>
            ) : (
              title
            )}
          </h2>
          <p className="lead">{subtitle}</p>
          <div className="hero__cta">
            <Link className="btn btn--red" href={buttonLink}>
              {buttonText}
            </Link>
            <Link className="btn btn--ghost" href={contactLink}>
              {contactText}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
