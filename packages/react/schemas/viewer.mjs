import { array, choice, draft, nonblank, object, ref, safeInteger, version } from "./common.mjs";

const multires = (level) => object({
  tileSize: { ...safeInteger, maximum: 8192 },
  levels: array(level, { minItems: 1, maxItems: 64 }),
}, ["tileSize", "levels"]);

// The document and inline forms differ only in their version field.
export function viewerConfig(versioned = false) {
  const common = {
    ...(versioned ? { schemaVersion: version } : {}),
    previewUrl: { ...nonblank, description: "Path to the converter's preview image." },
  };
  const required = [...(versioned ? ["schemaVersion"] : []), "type", "previewUrl", "urlTemplate", "multires"];
  const urlTemplate = (pattern) => ({
    ...nonblank,
    allOf: [{ pattern }],
    description: "Preserve the template and placeholders from the converter output.",
  });
  return {
    oneOf: [
      object({
        ...common,
        type: { const: "tile" },
        urlTemplate: urlTemplate("^(?:[^%]|%s|%l|%0*[hxucvywr])*$"),
        multires: multires(safeInteger),
        previewFaceOrder: array({ type: "string", ...choice("f", "r", "b", "l", "u", "d") }, {
          minItems: 6, maxItems: 6, uniqueItems: true,
          description: "Actual face order in the preview strip.",
        }),
      }, [...required, "previewFaceOrder"]),
      object({
        ...common,
        type: { const: "sphereTile" },
        urlTemplate: urlTemplate("^(?:[^%]|%l|%0*[hxucvywr])*$"),
        multires: multires(object({ width: safeInteger, height: safeInteger }, ["width", "height"])),
        indexBase: choice(0, 1),
      }, [...required, "indexBase"]),
    ],
  };
}

export const viewerSchema = {
  $schema: draft,
  title: "Pano View viewer.json",
  description: "A versioned panorama tile descriptor from the converter. Use the SDK to check level ordering and sphere proportions.",
  ...ref("ViewerDocument"),
  $defs: { ViewerDocument: viewerConfig(true) },
};
