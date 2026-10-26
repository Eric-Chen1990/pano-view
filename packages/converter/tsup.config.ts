import { defineConfig } from "tsup";

export default defineConfig([
  {
    entry: { index: "src/index.ts" },
    format: ["esm", "cjs"],
    platform: "node",
    target: "node20",
    external: ["sharp"],
    dts: true,
    sourcemap: true,
    splitting: false,
    outExtension: ({ format }) => ({ js: format === "esm" ? ".mjs" : ".cjs" }),
  },
  {
    entry: { cli: "src/cli.ts" },
    format: ["esm"],
    platform: "node",
    target: "node20",
    external: ["sharp"],
    sourcemap: true,
    splitting: false,
    outExtension: () => ({ js: ".mjs" }),
    banner: { js: "#!/usr/bin/env node" },
  },
]);
