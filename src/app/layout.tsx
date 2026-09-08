import type { Metadata, Viewport } from "next";
import { SerwistProvider } from "@serwist/turbopack/react";

import { OfflineProvider } from "@/components/offline-provider";
import { RestTimerProvider } from "@/components/rest-timer-provider";
import { getCurrentUser } from "@/server/auth";

import "./globals.css";

export const metadata: Metadata = {
  applicationName: "VicGym",
  title: {
    default: "VicGym",
    template: "%s · VicGym",
  },
  description: "A private workout log with personal programmes, history, and progress.",
  icons: {
    icon: [
      { url: "/icons/vicgym-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/vicgym-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
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

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const user = await getCurrentUser();
  return (
    <html lang="en">
      <body className="min-h-dvh antialiased">{user ? <SerwistProvider swUrl="/serwist/sw.js"><OfflineProvider userId={user.id}><RestTimerProvider>{children}</RestTimerProvider></OfflineProvider></SerwistProvider> : children}</body>
    </html>
  );
}
