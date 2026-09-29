import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Forwards /api requests to the Express server so the two work together.
export default defineConfig({
  plugins: [react()],
  server: { port: 5173, proxy: { "/api": "http://localhost:3001" } },
});
