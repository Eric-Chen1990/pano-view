import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["test/*.test.ts"],
  format: ["cjs"],
  target: "node22",
  outDir: ".test-dist",
  removeNodeProtocol: false,
});
