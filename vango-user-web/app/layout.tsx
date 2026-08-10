import type { Metadata } from "next";
import { AppProviders } from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3020"),
  title: { default: "VanGO Passenger", template: "%s | VanGO" },
  description: "Search trips, reserve seats, manage bookings, and keep your VanGO e-ticket ready.",
  openGraph: {
    title: "VanGO Passenger",
    description: "Your journey, in one place.",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "VanGO Passenger" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "VanGO Passenger",
    description: "Your journey, in one place.",
    images: ["/og.png"],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><AppProviders>{children}</AppProviders></body></html>;
}
