#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { PanoDataError, parsePanoProject, sceneFromViewerConfig } from "../dist/data.mjs";
import validators from "../dist/schemas/validators.cjs";

const usage = "Usage: pano-validate <project|viewer> <file.json>";
const args = process.argv.slice(2);
const [kind, file] = args;

if (args.length === 1 && (kind === "--help" || kind === "-h")) {
  console.log(usage);
} else if (args.length !== 2 || (kind !== "project" && kind !== "viewer")) {
  console.error(usage);
  process.exitCode = 1;
} else {
  try {
    const json = JSON.parse(await readFile(file, "utf8"));
    const validate = validators[kind];
    if (!validate(json)) {
      const errors = validate.errors.map(({ instancePath, message, params }) => {
        const property = params.missingProperty ?? params.additionalProperty ?? params.unevaluatedProperty;
        return `${instancePath || "/"} ${message}${property === undefined ? "" : ` (${property})`}`;
      });
      throw new Error(`Schema validation failed\n${[...new Set(errors)].join("\n")}`);
    }

    if (kind === "project") {
      parsePanoProject(json);
    } else {
      // This local check resolves relative asset paths without fetching them.
      sceneFromViewerConfig(json, { id: "viewer", baseUrl: "https://pano.invalid/" });
    }
    console.log(`${file}: valid ${kind} JSON`);
  } catch (error) {
    const field = error instanceof PanoDataError ? error.field : undefined;
    console.error(`${file}${field ? ` (${field})` : ""}: ${error.message}`);
    process.exitCode = 1;
  }
}
