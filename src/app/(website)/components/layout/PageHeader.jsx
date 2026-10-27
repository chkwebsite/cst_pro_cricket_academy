import Link from "next/link";

export default function PageHeader({
  title = "Page Title",
  breadcrumbs = [{ label: "Home", href: "/" }],
  current = "Page",
}) {
  return (
    <header className="page-header">
      <div className="container">
        <h1>{title}</h1>
        <nav aria-label="breadcrumb">
          <ol className="breadcrumb mt-3">
            {breadcrumbs.map((crumb, idx) => (
              <li key={idx} className="breadcrumb-item">
                <Link href={crumb.href}>{crumb.label}</Link>
              </li>
            ))}
            <li className="breadcrumb-item active" aria-current="page">
              {current}
            </li>
          </ol>
        </nav>
      </div>
    </header>
  );
}
