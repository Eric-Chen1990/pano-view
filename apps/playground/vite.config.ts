import { fileURLToPath, URL } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import basicSsl from "@vitejs/plugin-basic-ssl";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss(), basicSsl()],
  server: {
    host: true,
  },
  resolve: {
    alias: [
      {
        find: /^@ericchen1990\/pano-view\/styles\.css$/,
        replacement: fileURLToPath(
          new URL("../../packages/react/src/styles.css", import.meta.url),
        ),
      },
      {
        find: /^@ericchen1990\/pano-view$/,
        replacement: fileURLToPath(
          new URL("../../packages/react/src/index.ts", import.meta.url),
        ),
      },
    ],
  },
});
