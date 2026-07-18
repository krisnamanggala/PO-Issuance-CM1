import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "po-control.local";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? "https";
  const origin = `${protocol}://${host}`;

  return {
    title: "TPEC CM1 PO Monitoring",
    description: "SCM Category Management 1 purchase-order monitoring for releases, payment-term milestones, and contractual bonds.",
    metadataBase: new URL(origin),
    openGraph: {
      title: "TPEC CM1 PO Monitoring",
      description: "A shared SCM Category Management 1 PO register for schedules, payment-term milestones, and contractual bonds.",
      images: [{ url: `${origin}/og.png`, width: 1200, height: 630, alt: "TPEC CM1 PO Monitoring" }],
    },
    twitter: {
      card: "summary_large_image",
      title: "TPEC CM1 PO Monitoring",
      description: "SCM Category Management 1 PO monitoring for the workspace team.",
      images: [`${origin}/og.png`],
    },
    icons: { icon: "/favicon.png", shortcut: "/favicon.png" },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
