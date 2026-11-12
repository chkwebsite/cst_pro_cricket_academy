export default function robots() {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://stcricketacademy.com";

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/next_panel/",
          "/api/",
          "/cart",
          "/checkout",
          "/orders",
          "/profile",
          "/my-bookings",
          "/order-success/",
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
