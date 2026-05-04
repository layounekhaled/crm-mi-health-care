import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CRM MI HEALTH CARE — Gestion Commerciale Matériel Médical",
  description: "CRM SaaS professionnel pour la gestion commerciale de matériel médical en Algérie. Prospects, opportunités, opérations, suivi après-vente et performance des employés.",
  keywords: ["CRM", "MI HEALTH CARE", "matériel médical", "Algérie", "gestion commerciale", "prospection"],
  authors: [{ name: "layounekhaled" }],
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster position="top-right" richColors />
      </body>
    </html>
  );
}
