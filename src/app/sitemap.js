export default async function sitemap() {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://stcricketacademy.com";

  const staticRoutes = [
    "",
    "/about",
    "/programs",
    "/facilities",
    "/achievements",
    "/coaches",
    "/branches",
    "/ground-booking",
    "/tournaments",
    "/matches",
    "/gallery",
    "/shop",
    "/contact",
    "/book-free-trial",
    "/faq",
    "/rules",
    "/privacy-policy",
    "/terms-conditions",
    "/refund-policy",
    "/shipping-policy",
  ].map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date().toISOString(),
    changeFrequency:
      route === ""
        ? "daily"
        : route === "/matches" || route === "/tournaments"
        ? "daily"
        : "weekly",
    priority: route === "" ? 1.0 : route === "/programs" || route === "/ground-booking" ? 0.9 : 0.8,
  }));

  return staticRoutes;
}
