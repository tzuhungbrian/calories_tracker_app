import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Calories Tracker",
    short_name: "Calories",
    description: "Personal nutrition tracker backed by Google Sheets.",
    start_url: "/",
    display: "standalone",
    background_color: "#f7f9fc",
    theme_color: "#2563eb",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml"
      }
    ]
  };
}
