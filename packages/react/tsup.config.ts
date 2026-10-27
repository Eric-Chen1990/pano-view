import { defineConfig } from "tsup";

export default defineConfig([
  {
    banner: {
      js: '"use client";',
    },
    clean: false,
    dts: true,
    entry: ["src/index.ts"],
    esbuildPlugins: [
      {
        name: "shared-data-entry",
        setup(build) {
          // Reuse the same runtime exports (including error identity) across both entries.
          build.onResolve({ filter: /^\.\/data$/ }, (args) => {
            if (!args.importer.replace(/\\/g, "/").endsWith("/src/index.ts"))
              return;
            return {
              path:
                build.initialOptions.format === "cjs"
                  ? "./data.cjs"
                  : "./data.mjs",
              external: true,
            };
          });
        },
      },
    ],
    external: [
      "@react-three/drei",
      "@react-three/fiber",
      "@react-three/xr",
      "react",
      "react-dom",
      "three",
    ],
    format: ["esm", "cjs"],
    noExternal: ["howler"],
    outExtension({ format }) {
      return {
        js: format === "esm" ? ".mjs" : ".cjs",
      };
    },
    sourcemap: true,
    splitting: false,
  },
  {
    entry: { data: "src/data.ts" },
    clean: false,
    dts: true,
    format: ["esm", "cjs"],
    platform: "neutral",
    sourcemap: true,
    splitting: false,
    outExtension: ({ format }) => ({ js: format === "esm" ? ".mjs" : ".cjs" }),
  },
]);
