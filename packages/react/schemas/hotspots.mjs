import {
  array, boolean, choice, nonblank, nonnegative, number, object,
  positive, range, ref, safeInteger, string, tagged, unit,
} from "./common.mjs";

const stringOrNumber = { anyOf: [string, number] };
const position = {
  yaw: { ...number, description: "Horizontal angle in degrees. Positive values look right." },
  pitch: { ...range(-90, 90), description: "Vertical angle in degrees. Positive values look up." },
};
const view = {
  ...position,
  fov: { ...number, exclusiveMinimum: 0, exclusiveMaximum: 180, description: "Vertical field of view in degrees." },
};
const orientation = choice("surface", "billboard");
const layout = choice("horizontal", "vertical");
const crossOrigin = choice("", "anonymous", "use-credentials");
const strings = { anyOf: [string, array(nonblank, { minItems: 1 })] };

const base = object({
  id: nonblank,
  label: string,
  visible: boolean,
  interactive: boolean,
  pointerEvents: choice("auto", "none"),
  cursor: string,
  renderOrder: number,
  action: { ...ref("Action"), description: "Legacy click fallback. Prefer events.click." },
  events: object({ click: ref("Action"), pointerenter: ref("Action"), pointerleave: ref("Action") }),
}, ["id"]);

const tooltip = object({
  tooltip: { anyOf: [string, object({ text: string, image: string, imageAlt: string })] },
  tooltipTrigger: choice("always", "hover", "click"),
  tooltipPlacement: choice("top", "bottom", "left", "right"),
  tooltipMode: orientation,
  tooltipScaleMode: choice("inherit", "fov", "fixed"),
  tooltipOffset: number,
  tooltipAppearance: object({
    background: string, color: string, border: string, borderRadius: stringOrNumber,
    shadow: string, padding: stringOrNumber, fontSize: stringOrNumber,
    fontFamily: string, lineHeight: stringOrNumber, letterSpacing: stringOrNumber,
  }),
});

const placement = { position: ref("Position"), width: positive, height: positive, scale: positive, rotation: number };
const point = object({
  ...placement,
  mode: orientation,
  distance: positive,
  scaleMode: choice("fov", "fixed"),
  referenceFov: positive,
  opacity: unit,
}, ["position"]);

const mediaPlacement = {
  corners: array(ref("Position"), {
    minItems: 4, maxItems: 4,
    description: "Four clockwise vertices of a convex quadrilateral, starting at the top left.",
  }),
  chromaKey: object({ color: { ...string, pattern: "^#[0-9a-fA-F]{6}$" }, threshold: unit, smoothing: unit }, ["color"]),
};
const playback = { playing: boolean, loop: boolean, muted: boolean, volume: unit, crossOrigin };
const stroke = { stroke: string, strokeWidth: number, strokeOpacity: unit, strokeDashSize: number, strokeGapSize: number };

// Subschemas contribute fields to the hotspot. Close the combined object after the variant is selected.
function open(schema) {
  const { additionalProperties, ...fields } = schema;
  return fields;
}

const tooltipFields = ref("HotspotTooltip");
const pointFields = ref("PointPlacement");

function hotspot(type, properties, required, fieldSchemas = [tooltipFields, pointFields]) {
  return { allOf: [...fieldSchemas, open(tagged(type, properties, required))] };
}

const paint = { fill: nonblank, stroke: nonblank, strokeWidth: number };
const graphic = (kind, properties, required = []) => object({ kind, ...properties }, ["kind", ...required]);
const calloutContent = object({ title: string, text: string, image: string, imageAlt: string });
const portalClick = {
  if: {
    type: "object",
    properties: { events: { type: "object", properties: { click: true }, required: ["click"] } },
    required: ["events"],
  },
  then: {
    type: "object",
    properties: { events: { type: "object", properties: { click: ref("SceneAction") } } },
  },
  else: { type: "object", properties: { action: ref("SceneAction") }, required: ["action"] },
};

export const hotspotDefinitions = {
  Position: object(position, ["yaw", "pitch"]),
  View: object(view, ["yaw", "pitch", "fov"]),
  InitialView: object(view),
  PointPlacement: open(point),
  HotspotTooltip: open(tooltip),
  SceneAction: tagged("scene", { sceneId: { ...nonblank, description: "ID of an existing scene." } }, ["sceneId"]),
  Action: {
    oneOf: [
      ref("SceneAction"),
      tagged("popup", { popupId: { ...nonblank, description: "ID of an existing project popup." } }, ["popupId"]),
      tagged("view", { view: ref("View"), duration: nonnegative }, ["view"]),
      tagged("custom", { actionId: nonblank, params: { type: "object" } }, ["actionId"]),
    ],
  },
  Graphic: {
    oneOf: [
      graphic(choice("circle", "triangle", "diamond", "star", "arrow"), paint),
      graphic({ const: "rectangle" }, { ...paint, cornerRadius: number }),
      graphic({ const: "ring" }, { ...paint, innerRadius: number }),
      graphic({ const: "svg" }, { src: nonblank }, ["src"]),
      graphic({ const: "path" }, {
        ...paint,
        path: nonblank,
        viewBox: { type: "array", prefixItems: [number, number, positive, positive], minItems: 4, maxItems: 4 },
      }, ["path", "viewBox"]),
    ],
  },
  CalloutContent: {
    ...calloutContent,
    anyOf: ["title", "text", "image"].map((field) => ({ properties: { [field]: nonblank }, required: [field] })),
  },
  Hotspot: {
    ...open(base),
    unevaluatedProperties: false,
    oneOf: [
      hotspot("image", { src: nonblank, ...mediaPlacement }, ["src"]),
      hotspot("portal", {
        ...placement,
        shape: choice("rectangle", "circle", "ellipse"),
        frame: object({ color: nonblank, src: nonblank, thickness: range(0, 0.25) }),
        enterOnZoom: boolean,
        arrivalView: ref("View"),
      }, ["position"], [tooltipFields, portalClick]),
      hotspot("graphic", { graphic: ref("Graphic") }, ["graphic"]),
      hotspot("sequence", {
        src: nonblank, frameCount: safeInteger, frameDirection: layout, playing: boolean, fps: positive, loop: boolean,
      }, ["src", "frameCount"]),
      hotspot("video", {
        src: nonblank, ...mediaPlacement, poster: string, ...playback,
        playsInline: boolean, preload: choice("none", "metadata", "auto"),
      }, ["src"]),
      hotspot("audio", {
        src: { anyOf: [nonblank, array(nonblank, { minItems: 1 })] }, format: strings, ...playback,
        pauseWhenHidden: boolean, range: number, spatialAudio: boolean, soundDistance: positive,
        icon: string, playingIcon: string, marker: boolean,
      }, ["src"]),
      hotspot("text", {
        text: string, fontFamily: string, fontSize: positive, fontWeight: stringOrNumber,
        fontStyle: choice("normal", "italic"), color: string, background: string, backgroundOpacity: unit,
        padding: number, align: choice("left", "center", "right"), verticalAlign: choice("top", "middle", "bottom"),
        whiteSpace: choice("normal", "nowrap"), lineHeight: positive, borderRadius: number, stroke: string, strokeWidth: number,
      }, ["text"]),
      hotspot("iframe", {
        src: nonblank, title: string, sandbox: string, allow: string,
        referrerPolicy: choice("", "no-referrer", "no-referrer-when-downgrade", "origin", "origin-when-cross-origin",
          "same-origin", "strict-origin", "strict-origin-when-cross-origin", "unsafe-url"),
        loading: choice("eager", "lazy"), pointerPolicy: choice("hotspot", "content"), background: string,
      }, ["src"]),
      hotspot("callout", {
        content: ref("CalloutContent"), trigger: choice("click", "hover", "look", "always"),
        line: object({ color: string, angle: number, length: positive, width: positive }),
        appearance: object({
          background: string, color: string, titleBackground: string, titleColor: string, accentColor: string,
          fontFamily: string, width: positive, fontSize: positive, titleFontSize: positive,
          padding: nonnegative, borderRadius: nonnegative,
        }),
        animation: object({ lineDuration: nonnegative, contentDuration: nonnegative }),
        marker: object({ color: string }), lookAngle: number, lookDelay: number,
      }, ["content"], [pointFields]),
      hotspot("polygon", {
        vertices: array(ref("Position"), { minItems: 3 }), fill: string, fillOpacity: unit, ...stroke,
      }, ["vertices"], [tooltipFields]),
      hotspot("polyline", { vertices: array(ref("Position"), { minItems: 2 }), ...stroke }, ["vertices"], [tooltipFields]),
    ],
  },
};
