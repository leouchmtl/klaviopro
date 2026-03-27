import type { Metadata } from "next";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";
import Providers from "./providers";

export const metadata: Metadata = {
  title: "KlavioPro — CRM & Relances",
  description: "Gestion des prospects, relances et KPIs",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      <body className="flex min-h-screen">
        <Providers>
          <Sidebar />
          <div className="flex-1 flex flex-col min-h-screen overflow-hidden">
            <Topbar />
            <main className="flex-1 overflow-auto p-8">{children}</main>
          </div>
        </Providers>
      </body>
    </html>
  );
}
