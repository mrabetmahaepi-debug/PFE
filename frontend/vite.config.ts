import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const backendTarget =
    env.VITE_DEV_BACKEND_URL?.trim() ||
    `http://127.0.0.1:${env.VITE_DEV_BACKEND_PORT?.trim() || "5000"}`;

  return {
    plugins: [
      react(),
      tailwindcss({
        // Keep legacy page CSS compatible; Lightning CSS can choke on some files.
        optimize: false,
      }),
    ],
    server: {
      proxy: {
        "/api": {
          target: backendTarget,
          changeOrigin: true,
        },
        "/uploads": {
          target: backendTarget,
          changeOrigin: true,
        },
      },
    },
  };
});
