import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  cp,
  mkdtemp,
  mkdir,
  readFile,
  writeFile,
  symlink,
  rm,
} from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const editor = fileURLToPath(new URL("..", import.meta.url));
const viewer = fileURLToPath(new URL("../../react", import.meta.url));
const directory = await mkdtemp(join(tmpdir(), "pano-editor-consumer-"));
const run = (command, args, cwd = directory) =>
  execFileSync(command, args, { cwd, stdio: "pipe" }).toString();
try {
  for (const [name, source] of [
    ["pano-view", viewer],
    ["pano-editor", editor],
  ]) {
    const archive = JSON.parse(
      run("pnpm", ["pack", "--json", "--pack-destination", directory], source),
    );
    const destination = join(directory, "node_modules/@ericchen1990", name);
    await mkdir(destination, { recursive: true });
    run("tar", [
      "-xzf",
      resolve(directory, archive.filename),
      "--strip-components=1",
      "-C",
      destination,
    ]);
  }
  const manifest = JSON.parse(
    await readFile(
      join(directory, "node_modules/@ericchen1990/pano-editor/package.json"),
      "utf8",
    ),
  );
  const viewerManifest = JSON.parse(
    await readFile(
      join(directory, "node_modules/@ericchen1990/pano-view/package.json"),
      "utf8",
    ),
  );
  assert.equal(
    manifest.peerDependencies["@ericchen1990/pano-view"],
    `^${viewerManifest.version}`,
    "pnpm must rewrite workspace peer ranges for published consumers",
  );
  for (const name of [
    "react",
    "react-dom",
    "three",
    "@react-three",
    "@types",
  ]) {
    await symlink(
      join(viewer, "node_modules", name),
      join(directory, "node_modules", name),
    );
  }
  assert.ok(manifest.dependencies?.fflate, "ZIP runtime dependency must be declared");
  // This fixture assembles an isolated tarball consumer without a registry install.
  // Copy the declared ZIP runtime just as the fixture supplies React and viewer peers.
  await cp(join(editor, "node_modules/fflate"), join(directory, "node_modules/fflate"), {
    recursive: true,
    dereference: true,
  });
  const css = await readFile(
    join(directory, "node_modules/@ericchen1990/pano-editor/dist/styles.css"),
    "utf8",
  );
  assert.match(css, /--pne-accent/);
  const example = `
const html=server.renderToString(React.createElement(api.PanoEditor,{locale:"zh-CN"}));
if(!html.includes("全景编辑器")||html.includes('accept="image/*"'))throw Error("Local editor contract failed");
const host=server.renderToString(React.createElement(api.PanoEditor,{onImportPanorama:async()=>({viewerUrl:"https://cdn.test/viewer.json"})}));
if(!host.includes('accept="image/*"'))throw Error("Missing host import control");
`;
  await writeFile(
    join(directory, "consumer.mjs"),
    `import * as api from "@ericchen1990/pano-editor";import * as React from "react";import * as server from "react-dom/server";${example}`,
  );
  await writeFile(
    join(directory, "consumer.cjs"),
    `const api=require("@ericchen1990/pano-editor"),React=require("react"),server=require("react-dom/server");${example}`,
  );
  run(process.execPath, ["consumer.mjs"]);
  run(process.execPath, ["consumer.cjs"]);
  const typeExample = `import {PanoEditor,type PanoEditorProps} from "@ericchen1990/pano-editor";
import type {PanoProjectSceneDefinition} from "@ericchen1990/pano-view/data";
const props:PanoEditorProps={locale:"zh-CN",onImportPanorama:async(file,{signal,onProgress})=>{void file;void signal;onProgress({stage:"convert",progress:0.5});return {viewerUrl:"https://cdn.test/viewer.json"} satisfies PanoProjectSceneDefinition["source"];},onPickAsset:async request=>{void request.field;return undefined;},onSave:async project=>{void project.scenes;}};void[PanoEditor,props];`;
  for (const extension of ["mts", "cts"])
    await writeFile(join(directory, `consumer.${extension}`), typeExample);
  run(process.execPath, [
    join(editor, "node_modules/typescript/bin/tsc"),
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
  console.log(
    "Isolated editor tarball: ESM/CJS, SSR, CSS export and NodeNext integration types passed",
  );
} finally {
  await rm(directory, { recursive: true, force: true });
}
