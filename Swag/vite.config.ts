import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(),tailwindcss()],
  server: {
    // Do not silently fall back to another port: that can leave the browser on
    // a previous Vite instance serving an older version of the landing page.
    port: 5173,
    strictPort: true,
    watch: {
      // Chrome owns lock files in this local visual-regression profile.  Use a
      // path predicate (rather than only a glob) so it works consistently on
      // Windows paths as well.
      ignored: (watchedPath) => watchedPath.includes(".dashboard-check"),
    },
    headers: {
      "Cache-Control": "no-store",
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
