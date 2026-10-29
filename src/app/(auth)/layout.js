import { Inter, Oswald, Poppins } from "next/font/google";
import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap-icons/font/bootstrap-icons.css";
import "./globals.css";

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
  title: "Sign In | CST Cricket Academy",
  description: "Sign in to CST Cricket Academy portal for player, coach, and tournament management.",
  icons: {
    icon: "/images/website/favicon.png",
  },
};

export default function AuthLayout({ children }) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${oswald.variable} ${poppins.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
