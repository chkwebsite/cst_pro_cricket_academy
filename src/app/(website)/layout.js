import { Inter, Oswald, Poppins } from "next/font/google";
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

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const oswald = Oswald({
  variable: "--font-oswald",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  display: "swap",
});

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["500", "600"],
  display: "swap",
});

export const metadata = {
  title: "ST Cricket Academy | Professional Cricket Coaching",
  description:
    "ST Cricket Academy offers professional cricket coaching for all ages with expert coaches, turf pitches and a structured player development programme.",
  icons: {
    icon: "/images/website/favicon.png",
  },
};

export const dynamic = "force-dynamic";

export default async function WebsiteLayout({ children }) {
  const session = await getServerSession();

  return (
    <html
      lang="en"
      className={`${inter.variable} ${oswald.variable} ${poppins.variable}`}
    >
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
