import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  base: "./",
  server: { port: 4317, strictPort: true, host: "0.0.0.0", allowedHosts: true },
  preview: { port: 4317, strictPort: true, host: "0.0.0.0", allowedHosts: true },
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
  },
});
