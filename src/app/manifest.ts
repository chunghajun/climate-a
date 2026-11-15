import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "CliMate",
    short_name: "CliMate",
    description: "내 일정에 맞춘 날씨 알림",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#1E2547",
    lang: "ko",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
