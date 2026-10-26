import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, writeFile, rm, copyFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Test the exact archive in an isolated project, without workspace aliases or a React installation.
const packageDir = fileURLToPath(new URL("..", import.meta.url));
const directory = await mkdtemp(join(tmpdir(), "pano-converter-consumer-"));
const run = (executable, args, cwd = directory, shell = false) => {
  try {
    return execFileSync(executable, args, {
      cwd,
      shell,
      stdio: "pipe",
      env: { ...process.env, npm_config_cache: join(directory, "npm-cache") },
    }).toString();
  } catch (error) {
    throw new Error(
      `${executable} ${args.join(" ")} failed:\n${error.stdout?.toString() ?? ""}${error.stderr?.toString() ?? ""}`,
      { cause: error },
    );
  }
};
const pnpm = process.env.PANO_PNPM_BIN ?? "pnpm";
const install = (args) =>
  pnpm.endsWith(".cjs")
    ? run(process.execPath, [pnpm, ...args])
    : run(pnpm, args, directory, process.platform === "win32");
try {
  const npmCli = [
    join(dirname(process.execPath), "node_modules/npm/bin/npm-cli.js"),
    join(
      dirname(dirname(process.execPath)),
      "lib/node_modules/npm/bin/npm-cli.js",
    ),
  ].find(existsSync);
  assert.ok(
    npmCli,
    "Cannot locate the npm CLI next to the Node.js installation.",
  );
  const packResult = JSON.parse(
    run(
      process.execPath,
      [npmCli, "pack", "--json", "--pack-destination", directory],
      packageDir,
    ),
  );
  // npm 12 keys JSON pack output by package name; older npm versions return an array.
  const packed = Array.isArray(packResult)
    ? packResult[0]
    : Object.values(packResult)[0];
  const files = packed.files.map((file) => file.path);
  for (const path of [
    "dist/index.mjs",
    "dist/index.cjs",
    "dist/index.d.ts",
    "dist/index.d.cts",
    "dist/cli.mjs",
    "LICENSE",
    "README.md",
    "README.zh-CN.md",
  ])
    assert.ok(files.includes(path), `missing ${path}`);
  assert.ok(
    !files.some(
      (file) => file.startsWith("node_modules/") || /(^|\/)\.env/.test(file),
    ),
  );
  await writeFile(
    join(directory, "package.json"),
    JSON.stringify({
      private: true,
      type: "module",
      dependencies: {
        "@ericchen1990/pano-converter": `file:${join(directory, packed.filename)}`,
      },
      devDependencies: { typescript: "5.9.3", "@types/node": "22.20.1" },
    }),
  );
  install([
    "install",
    "--ignore-scripts",
    ...(process.env.PANO_SMOKE_OFFLINE ? ["--offline"] : []),
  ]);
  await copyFile(
    new URL("./consumer.mjs", import.meta.url),
    join(directory, "consumer.mjs"),
  );
  process.stdout.write(run(process.execPath, ["consumer.mjs"]));
  for (const extension of ["mts", "cts"])
    await writeFile(
      join(directory, `consumer.${extension}`),
      `import { convertImage, restoreImage, type ConversionManifest } from "@ericchen1990/pano-converter";\nconst convert: typeof convertImage = convertImage;\nconst restore: typeof restoreImage = restoreImage;\nconst version: ConversionManifest["schemaVersion"] = 1;\nvoid [convert, restore, version];\n`,
    );
  run(process.execPath, [
    join(directory, "node_modules/typescript/bin/tsc"),
    "--noEmit",
    "--strict",
    "--skipLibCheck",
    "--target",
    "ES2022",
    "--module",
    "NodeNext",
    "--moduleResolution",
    "NodeNext",
    "consumer.mts",
    "consumer.cts",
  ]);
  const version = run(process.execPath, [
    join(directory, "node_modules/@ericchen1990/pano-converter/dist/cli.mjs"),
    "--version",
  ]);
  assert.equal(
    version.trim(),
    JSON.parse(await readFile(join(packageDir, "package.json"), "utf8"))
      .version,
  );
  const shim = join(
    directory,
    "node_modules/.bin",
    process.platform === "win32" ? "pano-convert.cmd" : "pano-convert",
  );
  assert.equal(
    run(shim, ["--version"], directory, process.platform === "win32").trim(),
    version.trim(),
  );
  console.log(
    `Tarball consumer passed: ${packed.filename}; ESM/CJS runtime, NodeNext types, CLI, no React.`,
  );
} finally {
  await rm(directory, { recursive: true, force: true });
}
