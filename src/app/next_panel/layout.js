import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import jwt from "jsonwebtoken";
import "bootstrap/dist/css/bootstrap.min.css";
import "./globals.css";
import { BootstrapJs } from "../components/utils/BootstrapClient";
import Sidebar from "./components/Sidebar";
import { UserProvider } from "./components/UserContext";
import { getServerSession } from "../components/lib/auth-session";

export const metadata = {
  title: "CST Pro Cricket Academy",
  description: "CST Pro Cricket Academy Portal",
};

export default async function RootLayout({ children }) {
  const token = (await cookies()).get("auth_token")?.value;

  if (!token) {
    redirect("/login");
  }

  try {
    jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    redirect("/login");
  }

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
        <BootstrapJs />
        <UserProvider initialSession={session}>
          <Sidebar>{children}</Sidebar>
        </UserProvider>
      </body>
    </html>
  );
}
