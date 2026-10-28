import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  banner: { js: '"use client";' },
  clean: true,
  dts: true,
  format: ["esm", "cjs"],
  external: [
    "react",
    "react-dom",
    "@ericchen1990/pano-view",
    "@ericchen1990/pano-view/data",
    "@ericchen1990/pano-view/ui",
  ],
  sourcemap: true,
  splitting: false,
  outExtension: ({ format }) => ({ js: format === "esm" ? ".mjs" : ".cjs" }),
});
