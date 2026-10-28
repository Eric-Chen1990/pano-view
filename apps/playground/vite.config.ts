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
    dedupe: [
      "react",
      "react-dom",
      "three",
      "@react-three/fiber",
      "@react-three/drei",
      "@react-three/xr",
    ],
    alias: [
      {
        find: /^@ericchen1990\/pano-view\/ui\/styles\.css$/,
        replacement: fileURLToPath(new URL("../../packages/react/src/ui/styles.css", import.meta.url)),
      },
      {
        find: /^@ericchen1990\/pano-view\/ui$/,
        replacement: fileURLToPath(new URL("../../packages/react/src/ui.ts", import.meta.url)),
      },
      {
        find: /^@ericchen1990\/pano-editor\/styles\.css$/,
        replacement: fileURLToPath(
          new URL("../../packages/editor/src/styles.css", import.meta.url),
        ),
      },
      {
        find: /^@ericchen1990\/pano-editor$/,
        replacement: fileURLToPath(
          new URL("../../packages/editor/src/index.ts", import.meta.url),
        ),
      },
      {
        find: /^@ericchen1990\/pano-view\/data$/,
        replacement: fileURLToPath(
          new URL("../../packages/react/src/data.ts", import.meta.url),
        ),
      },
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
