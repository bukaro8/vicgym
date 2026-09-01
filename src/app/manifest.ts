import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "VicGym",
    short_name: "VicGym",
    description: "A private workout log for one local gym.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#F7FAF7",
    theme_color: "#3FA66A",
    icons: [
      { src: "/icons/vicgym-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/vicgym-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/vicgym-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
