import Link from "next/link";

export default function PageHeader({
  title = "Page Title",
  eyebrow = "",
  breadcrumbs = [{ label: "Home", href: "/" }],
  current = "Page",
}) {
  return (
    <section className="page-hero">
      <div className="container" data-reveal>
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h1>{title}</h1>
        <div className="crumbs">
          {breadcrumbs.map((crumb, idx) => (
            <span key={idx} style={{ display: "inline-flex", gap: "10px", alignItems: "center" }}>
              <Link href={crumb.href}>{crumb.label}</Link>
              <span>/</span>
            </span>
          ))}
          <span>{current}</span>
        </div>
      </div>
    </section>
  );
}
