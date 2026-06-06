import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    watch: {
      ignored: ["**/pipecat_service/.venv/**", "**/__pycache__/**"]
    },
    proxy: {
      "/api": "http://127.0.0.1:5174"
    }
  }
});
