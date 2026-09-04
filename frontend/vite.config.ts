import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "src") } },
  build: {
    rollupOptions: {
      output: {
        // Keep the 3D stack out of the initial bundle so the console shell
        // and the inspection workflow paint before any WebGL work begins.
        manualChunks(id: string) {
          if (id.includes("node_modules/three") || id.includes("@react-three")) return "three";
        },
      },
    },
  },
});
