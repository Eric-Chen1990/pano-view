import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const packageDir = fileURLToPath(new URL("..", import.meta.url));
const directory = await mkdtemp(join(tmpdir(), "pano-view-data-consumer-"));
const run = (command, args, cwd = directory) =>
  execFileSync(command, args, { cwd, stdio: "pipe" }).toString();
try {
  const output = JSON.parse(
    run("npm", ["pack", "--json", "--pack-destination", directory], packageDir)
  );
  const archive = Array.isArray(output) ? output[0] : Object.values(output)[0];
  const destination = join(directory, "node_modules/@ericchen1990/pano-view");
  await mkdir(destination, { recursive: true });
  run("tar", [
    "-xzf",
    join(directory, archive.filename),
    "--strip-components=1",
    "-C",
    destination,
  ]);
  const data = await readFile(join(destination, "dist/data.mjs"), "utf8");
  assert.ok(!data.includes('"use client"') && !data.includes("'use client'"));
  assert.ok(!data.includes("../../../shared/"));
  const example = `
const config = {type:"tile",multires:{tileSize:512,levels:[512]},urlTemplate:"tiles/%s/%l/%v_%h.webp",previewUrl:"preview.webp",previewFaceOrder:["l","f","r","b","u","d"]};
const scene = api.sceneFromViewerConfig(config,{id:"room",baseUrl:"https://cdn.test/room/"});
if(scene.previewUrl!=="https://cdn.test/room/preview.webp") throw Error("Incorrect URL");
const project=await api.loadPanoProject({schemaVersion:1,scenes:[{id:"room",source:{viewerConfig:config}}]},{baseUrl:"https://cdn.test/room/"});
if(project.initialSceneId!=="room")throw Error("Incorrect initial scene");
`;
  // The extracted package has no React, Three.js or Sharp installation.
  await writeFile(
    join(directory, "consumer.mjs"),
    `import * as api from "@ericchen1990/pano-view/data";\n${example}`
  );
  await writeFile(
    join(directory, "consumer.cjs"),
    `const api=require("@ericchen1990/pano-view/data");\n(async()=>{${example}})().catch(e=>{console.error(e);process.exitCode=1});`
  );
  run(process.execPath, ["consumer.mjs"]);
  run(process.execPath, ["consumer.cjs"]);
  const typeExample = `import {sceneFromViewerConfig,loadPanoProject,type ViewerConfig,type LoadedPanoProject} from "@ericchen1990/pano-view/data";
import type {ProjectScenesProps} from "@ericchen1990/pano-view";
declare const config:ViewerConfig;
const scene=sceneFromViewerConfig(config,{id:"room",baseUrl:"https://cdn.test/"});
const loaded:Promise<LoadedPanoProject>=loadPanoProject({schemaVersion:1,scenes:[{id:"room",source:{viewerConfig:config}}]},{baseUrl:"https://cdn.test/"});
declare const project:LoadedPanoProject;
const props:ProjectScenesProps={project};void [scene,loaded,props];`;
  for (const extension of ["mts", "cts"])
    await writeFile(join(directory, `consumer.${extension}`), typeExample);
  const tsc = fileURLToPath(
    new URL("../node_modules/typescript/bin/tsc", import.meta.url)
  );
  run(process.execPath, [
    tsc,
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
    "Isolated tarball: ESM/CJS data runtime, client-free entry and NodeNext declarations passed"
  );
} finally {
  await rm(directory, { recursive: true, force: true });
}
