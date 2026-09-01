import type { Metadata, Viewport } from "next";
import { SerwistProvider } from "@serwist/turbopack/react";

import { OfflineProvider } from "@/components/offline-provider";
import { RestTimerProvider } from "@/components/rest-timer-provider";

import "./globals.css";

export const metadata: Metadata = {
  applicationName: "VicGym",
  title: {
    default: "VicGym",
    template: "%s · VicGym",
  },
  description: "A private workout log for one local gym.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "VicGym",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  colorScheme: "light",
  themeColor: "#3FA66A",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-dvh antialiased"><SerwistProvider swUrl="/serwist/sw.js"><OfflineProvider><RestTimerProvider>{children}</RestTimerProvider></OfflineProvider></SerwistProvider></body>
    </html>
  );
}
