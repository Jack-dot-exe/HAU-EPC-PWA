import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

const base = "/HAU-EPC-PWA/";

// https://vite.dev/config/
export default defineConfig({
  base,
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: [
        "favicon.ico",
        "favicon.svg",
        "favicon-96x96.png",
        "apple-touch-icon.png",
      ],
      manifestFilename: "manifest.webmanifest",
      manifest: {
        name: "EPC Tool by Heli Austria",
        short_name: "EPC Tool",
        description:
          "Engine power check recording and history tracking for Heli Austria.",
        start_url: base,
        scope: base,
        display: "standalone",
        background_color: "#f4f1e7",
        theme_color: "#0f3d3e",
        icons: [
          {
            src: `${base}web-app-manifest-192x192.png`,
            sizes: "192x192",
            type: "image/png",
            purpose: "any maskable",
          },
          {
            src: `${base}web-app-manifest-512x512.png`,
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
          },
          {
            src: `${base}apple-touch-icon.png`,
            sizes: "180x180",
            type: "image/png",
          },
        ],
      },
      workbox: {
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        navigateFallback: "index.html",
        globPatterns: ["**/*.{js,css,html,ico,png,svg,webmanifest}"],
      },
    }),
  ],
});


