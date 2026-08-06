import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const apiUrl = env.VITE_API_BASE_URL || env.VITE_API_URL;
  if (mode === "production" && !apiUrl) throw new Error("VITE_API_BASE_URL is required for production builds.");
  return {
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: "prompt",
        manifest: {
          name: "ARA Admin",
          short_name: "ARA Admin",
          description: "Hệ thống quản lý vận hành ARA",
          start_url: "/",
          scope: "/",
          display: "standalone",
          background_color: "#ffffff",
          theme_color: "#ffffff",
          lang: "vi",
          icons: [
            { src: "/pwa-192x192.png", sizes: "192x192", type: "image/png" },
            { src: "/pwa-512x512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" }
          ]
        },
        workbox: {
          globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
          navigateFallback: "/index.html",
          navigateFallbackDenylist: [/^\/api(?:\/|$)/],
          cleanupOutdatedCaches: true
        }
      })
    ],
    define: { "import.meta.env.VITE_API_URL": JSON.stringify(apiUrl || "") },
    build: {
      target: "es2020",
      sourcemap: false,
      rollupOptions: { output: { manualChunks: { react: ["react", "react-dom", "react-router-dom"], realtime: ["axios", "socket.io-client"] } } }
    },
    server: { host: "0.0.0.0", port: 5174 }
  };
});
