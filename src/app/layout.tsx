import type { Metadata } from "next";
import { Nunito, Quicksand } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/auth";

// Match the Lea brand typography (lea.legali.ai): Quicksand for headings,
// Nunito for body — warm, rounded, friendly. Loaded & self-hosted by next/font
// and exposed as CSS variables consumed by Tailwind (see tailwind.config.ts).
const nunito = Nunito({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const quicksand = Quicksand({ subsets: ["latin"], variable: "--font-heading", display: "swap" });

export const metadata: Metadata = {
  title: "Lea Admin Panel",
  description: "Internal operator control plane for the Lea platform.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${nunito.variable} ${quicksand.variable}`}>
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
