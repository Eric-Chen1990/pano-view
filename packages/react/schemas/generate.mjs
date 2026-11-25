import { mkdir, readFile, writeFile } from "node:fs/promises";
import Ajv2020 from "ajv/dist/2020.js";
import standaloneCode from "ajv/dist/standalone/index.js";
import { projectSchema } from "./project.mjs";
import { viewerSchema } from "./viewer.mjs";

const skill = new URL("../../../skills/pano-view-project/references/", import.meta.url);
const dist = new URL("../dist/schemas/", import.meta.url);
const mode = process.argv[2];
if (!["--build", "--sync", "--check"].includes(mode)) {
  throw new Error("Expected --build, --sync, or --check");
}

const destination = mode === "--build" ? dist : skill;
if (mode !== "--check") await mkdir(destination, { recursive: true });

for (const [name, schema] of [["project", projectSchema], ["viewer", viewerSchema]]) {
  const filename = `${name}.schema.json`;
  const path = new URL(filename, destination);
  const json = JSON.stringify({
    $comment: "Generated from packages/react/schemas. Run the viewer package's schemas:sync script to update the Skill copies.",
    ...schema,
  }, null, 2) + "\n";
  if (mode === "--check") {
    if (await readFile(path, "utf8").catch((error) => {
      if (error.code === "ENOENT") return undefined;
      throw error;
    }) !== json) {
      throw new Error(`${filename} is out of date. Run pnpm --filter @ericchen1990/pano-view schemas:sync.`);
    }
  } else {
    await writeFile(path, json);
  }
}

if (mode === "--build") {
  const ajv = new Ajv2020({ strict: true, code: { source: true } });
  ajv.addSchema(projectSchema, "project");
  ajv.addSchema(viewerSchema, "viewer");
  const validators = standaloneCode(ajv, { project: "project", viewer: "viewer" });
  await writeFile(new URL("validators.cjs", dist), validators);
}
