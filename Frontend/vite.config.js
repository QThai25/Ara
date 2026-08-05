import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const apiUrl = env.VITE_API_BASE_URL || env.VITE_API_URL;
  if (mode === "production" && !apiUrl) throw new Error("VITE_API_BASE_URL is required for production builds.");
  return {
    plugins: [react()],
    define: { "import.meta.env.VITE_API_URL": JSON.stringify(apiUrl || "") },
    build: {
      target: "es2020",
      sourcemap: false,
      rollupOptions: { output: { manualChunks: { react: ["react", "react-dom", "react-router-dom"], realtime: ["axios", "socket.io-client"] } } }
    }
  };
});
