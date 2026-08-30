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
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/icon-maskable.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
    ],
  };
}
