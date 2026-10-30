import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap-icons/font/bootstrap-icons.css";
import "./website.css";
import { BootstrapJs } from "../components/utils/BootstrapClient";
import { UserProvider } from "../next_panel/components/UserContext";
import { getServerSession } from "../components/lib/auth-session";
import { CartProvider } from "./components/cart/CartContext";
import CartDrawer from "./components/cart/CartDrawer";
import Header from "./components/layout/Header";
import Footer from "./components/layout/Footer";
import BackToTop from "./components/layout/BackToTop";
import WhatsAppButton from "./components/layout/WhatsAppButton";
import MobileBar from "./components/layout/MobileBar";
import ScrollRevealInit from "./components/layout/ScrollRevealInit";

export const metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://stcricketacademy.com"),
  title: {
    default: "CST Cricket Academy | Professional Cricket Coaching & Training",
    template: "%s | CST Cricket Academy",
  },
  description:
    "CST Cricket Academy offers professional cricket coaching for all ages with BCCI-certified coaches, natural turf pitches, modern indoor nets, and structured player development programs.",
  keywords: [
    "Cricket Academy",
    "Professional Cricket Coaching",
    "Cricket Academy Near Me",
    "Turf Pitch Cricket Booking",
    "Junior Cricket Academy",
    "Cricket Batting Coaching",
    "Fast Bowling Masterclass",
    "Cricket Ground Rental",
    "Cricket Tournaments",
    "Cricket Academy Admission",
  ],
  authors: [{ name: "CST Cricket Academy" }],
  creator: "CST Cricket Academy",
  publisher: "CST Cricket Academy",
  openGraph: {
    type: "website",
    locale: "en_IN",
    url: "https://stcricketacademy.com",
    siteName: "CST Cricket Academy",
    title: "CST Cricket Academy | Professional Cricket Coaching & Training",
    description:
      "CST Cricket Academy offers professional cricket coaching for all ages with BCCI-certified coaches, natural turf pitches, modern indoor nets, and structured player development programs.",
    images: [
      {
        url: "/images/website/favicon.png",
        width: 800,
        height: 600,
        alt: "CST Cricket Academy",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "CST Cricket Academy | Professional Cricket Coaching & Training",
    description:
      "CST Cricket Academy offers professional cricket coaching for all ages with BCCI-certified coaches, natural turf pitches, modern indoor nets, and structured player development programs.",
    images: ["/images/website/favicon.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  icons: {
    icon: "/images/website/favicon.png",
  },
};

export const dynamic = "force-dynamic";

export default async function WebsiteLayout({ children }) {
  const session = await getServerSession();

  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Oswald:wght@500;600;700&family=Poppins:wght@500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <UserProvider initialSession={session}>
          <CartProvider>
            <BootstrapJs />
            <ScrollRevealInit />
            <Header />
            <main id="main-content">{children}</main>
            <Footer />
            <WhatsAppButton />
            <BackToTop />
            <MobileBar />
            <CartDrawer />
          </CartProvider>
        </UserProvider>
      </body>
    </html>
  );
}
