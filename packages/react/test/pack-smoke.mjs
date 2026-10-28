import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { access, mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
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
  const main = await readFile(join(destination, "dist/index.mjs"), "utf8");
  assert.ok(!main.includes("@radix-ui/react-dialog"), "Core must not load Dialog code");
  for (const extension of ["mjs", "cjs"]) {
    const ui = await readFile(join(destination, `dist/ui.${extension}`), "utf8");
    assert.ok(ui.includes(`./index.${extension}`), "UI must share the core runtime");
    assert.ok(!ui.includes("createContext("), "UI must not duplicate overlay Context");
    assert.ok(ui.includes("ProjectPopupDialog"), "Shared popup UI must be exported");
  }
  assert.ok((await readFile(join(destination, "dist/ui/styles.css"), "utf8")).includes(".pano-dialog-content"));
  await Promise.all(["dialogs.md", "dialogs.zh-CN.md"].map((name) => access(join(destination, "docs", name))));
  const example = `
const limits={yaw:{min:170,max:-170},fov:{min:60,max:60}};
const config = {type:"tile",multires:{tileSize:512,levels:[512]},urlTemplate:"tiles/%s/%l/%v_%h.webp",previewUrl:"preview.webp",previewFaceOrder:["l","f","r","b","u","d"]};
const scene = api.sceneFromViewerConfig(config,{id:"room",baseUrl:"https://cdn.test/room/"});
if(scene.previewUrl!=="https://cdn.test/room/preview.webp") throw Error("Incorrect URL");
const project=await api.loadPanoProject({schemaVersion:1,scenes:[{id:"room",source:{viewerConfig:config},viewLimits:limits}]},{baseUrl:"https://cdn.test/room/"});
if(project.initialSceneId!=="room")throw Error("Incorrect initial scene");
if(project.scenes[0].scene.viewLimits.yaw.min!==170)throw Error("Limits missing from packed loader");
const marker={id:"custom",type:"text",text:"Hi",position:{yaw:0,pitch:0},events:{pointerenter:{type:"custom",actionId:"show",params:{src:"blob:business"}}}};
const parsed=api.parsePanoProject({schemaVersion:1,scenes:[{id:"room",source:{viewerConfig:config},hotspots:[marker]}]});
if(api.hotspotAction(parsed.scenes[0].hotspots[0],"pointerenter").params.src!=="blob:business")throw Error("Missing custom action parameters");
const popup=api.resolveProjectPopupAssets({id:"story",title:"Story",blocks:[{id:"photo",type:"image",src:"photo.jpg"}]},"https://cdn.test/tour/");
if(popup.blocks[0].src!=="https://cdn.test/tour/photo.jpg")throw Error("Incorrect popup URL");
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
  const typeExample = `import {sceneFromViewerConfig,loadPanoProject,type ViewerConfig,type PanoViewLimits,type LoadedPanoProject} from "@ericchen1990/pano-view/data";
import type {ProjectScenesProps} from "@ericchen1990/pano-view";
import type {PanoDialogProps,PanoDialogContentProps,ProjectPopupDialogProps} from "@ericchen1990/pano-view/ui";
import type {PanoOverlayRenderContext,PanoViewerProps} from "@ericchen1990/pano-view";
declare const config:ViewerConfig;
const limits:PanoViewLimits={yaw:{min:170,max:-170},fov:{min:60,max:60}};
const viewer:PanoViewerProps={viewLimits:limits};
const scene=sceneFromViewerConfig(config,{id:"room",baseUrl:"https://cdn.test/"});
const loaded:Promise<LoadedPanoProject>=loadPanoProject({schemaVersion:1,scenes:[{id:"room",source:{viewerConfig:config},viewLimits:limits}]},{baseUrl:"https://cdn.test/"});
declare const project:LoadedPanoProject;
const props:ProjectScenesProps={project,onHotspotEvent:event=>{void event.trigger;event.preventDefault();},onCustomAction:async event=>{void [event.action.actionId,event.action.params,event.trigger];},onPopupRequest:({popup,sceneId,hotspot})=>{void [popup.blocks,sceneId,hotspot.action];}};
const popupDialog:ProjectPopupDialogProps={popup:null,onOpenChange:()=>{}};
const dialog:PanoDialogProps={open:true,onOpenChange:(_open:boolean)=>{},title:"Details",children:null};
const content:PanoDialogContentProps={"aria-label":"Details"};
const overlay:NonNullable<PanoViewerProps["renderOverlay"]>=(context:PanoOverlayRenderContext)=>{const width:number=context.size.width;const left:number=context.visibleRect.left;void [width,left,context.portalContainer,context.isFullscreen];return null;};
scene.viewLimits=limits;void [viewer,scene,loaded,props,dialog,content,overlay,popupDialog];`;
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
    "Isolated tarball: ESM/CJS data runtime, client-free entry, UI runtime boundary, CSS and NodeNext declarations passed"
  );
} finally {
  await rm(directory, { recursive: true, force: true });
}
