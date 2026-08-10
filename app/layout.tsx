import type { Metadata } from "next";
import { ensureBootstrapAccounts } from "../lib/bootstrap-accounts";
import "./globals.css";
import { AppProviders } from "./providers";

export const metadata: Metadata = {
  metadataBase: new URL("https://vango.vercel.app"),
  title: {
    default: "VanGO | Passenger transport, made simple",
    template: "%s | VanGO",
  },
  description:
    "A complete passenger booking and transport operations platform for travelers, administrators, and platform teams.",
  icons: {
    icon: "/og.png",
    shortcut: "/og.png",
  },
  openGraph: {
    title: "VanGO — One platform for every journey",
    description:
      "Book seats, run trips, and manage the network from one responsive platform.",
    images: ["/og.png"],
  },
  twitter: {
    card: "summary_large_image",
    title: "VanGO — One platform for every journey",
    description:
      "Book seats, run trips, and manage the network from one responsive platform.",
    images: ["/og.png"],
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  await ensureBootstrapAccounts();
  return (
    <html lang="en">
      <body><AppProviders>{children}</AppProviders></body>
    </html>
  );
}
