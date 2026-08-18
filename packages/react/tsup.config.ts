import { defineConfig } from "tsup";

export default defineConfig({
  banner: {
    js: '"use client";',
  },
  clean: true,
  dts: true,
  entry: ["src/index.ts"],
  external: [
    "@react-three/drei",
    "@react-three/fiber",
    "@react-three/xr",
    "react",
    "react-dom",
    "three",
  ],
  format: ["esm", "cjs"],
  outExtension({ format }) {
    return {
      js: format === "esm" ? ".mjs" : ".cjs",
    };
  },
  sourcemap: true,
  splitting: false,
});
