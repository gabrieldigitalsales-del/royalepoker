import { defineConfig } from "vite";

export default defineConfig({
  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: true,
    proxy: {
      "/api": { target: "http://127.0.0.1:4190", changeOrigin: true },
      "/avatar": { target: "http://127.0.0.1:4190", changeOrigin: true },
      "/live": { target: "ws://127.0.0.1:4190", ws: true, changeOrigin: true },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("/@supabase/")) return "supabase";
          if (id.includes("/framer-motion/") || id.includes("/motion-dom/")) return "motion";
          if (/node_modules\/(react|react-dom|react-router|scheduler)\//.test(id)) return "react";
        },
      },
    },
  },
});
