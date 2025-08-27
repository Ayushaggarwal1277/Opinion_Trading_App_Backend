import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  base: '/Opinion_Trading_App_Backend/',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
  }
});
