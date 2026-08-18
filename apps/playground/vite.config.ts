import { fileURLToPath, URL } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@ericchen1990/pano-view": fileURLToPath(
        new URL("../../packages/react/src/index.ts", import.meta.url),
      ),
    },
  },
});
