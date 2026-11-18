import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

export default defineConfig(({ mode }) => ({
  base: "/", // importante para servir via Flask

  server: {
    port: 8080,

    // 🔥 necessário para funcionar junto com Flask
    proxy: {
      "/api": {
        target: "http://localhost:8001",
        changeOrigin: true,
        secure: false,

        rewrite: (path) => path.replace(/^\/api/, ""),
      },
      "/socket.io": {
        target: "http://localhost:8001",
        ws: true,
      },
    },
  },

  plugins: [react(), mode === "development" && componentTagger()].filter(
    Boolean,
  ),

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
