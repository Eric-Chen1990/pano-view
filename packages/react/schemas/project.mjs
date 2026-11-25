import {
  array, boolean, choice, draft, nonblank, nonnegative, number, object,
  positive, range, ref, string, tagged, unit, version,
} from "./common.mjs";
import { hotspotDefinitions } from "./hotspots.mjs";
import { viewerConfig } from "./viewer.mjs";

const length = {
  anyOf: [positive, {
    ...string,
    pattern: "^\\s*0*(?:100(?:\\.0+)?|[1-9]\\d?(?:\\.\\d+)?|0\\.\\d*[1-9]\\d*)%\\s*$",
  }],
  description: "Positive CSS pixels or a percentage in (0, 100], such as 40%.",
};
const insetLength = { anyOf: [number, nonblank] };
const latitudeLongitude = object({ lat: range(-90, 90), lng: range(-180, 180) }, ["lat", "lng"]);
const zoom = range(0, 24);
const viewRange = (limit) => object({ min: limit, max: limit }, ["min", "max"]);
const resource = { ...nonblank, description: "An existing asset path or URL. Relative paths use the project directory." };

const definitions = {
  ...hotspotDefinitions,
  ViewerConfig: viewerConfig(),
  Scene: object({
    id: { ...nonblank, description: "Unique scene ID within the project." },
    title: nonblank,
    source: {
      oneOf: [
        object({
          viewerUrl: { ...nonblank, description: "Existing viewer.json URL, relative to the project document or absolute." },
          baseUrl: nonblank,
        }, ["viewerUrl"]),
        object({ viewerConfig: ref("ViewerConfig"), baseUrl: nonblank }, ["viewerConfig"]),
      ],
    },
    initialView: ref("InitialView"),
    viewLimits: object({
      yaw: { ...viewRange(range(-180, 180)), description: "A min greater than max crosses ±180 degrees." },
      pitch: viewRange(range(-90, 90)),
      fov: viewRange(range(1, 179)),
    }),
    northYaw: { ...number, description: "Viewer yaw when facing true north, in degrees." },
    levelCorrection: object({ pitch: range(-90, 90), roll: range(-180, 180) }),
    hotspots: array(ref("Hotspot")),
  }, ["id", "source"]),
  Popup: object({ id: nonblank, title: nonblank, blocks: array(ref("PopupBlock")) }, ["id", "title", "blocks"]),
  PopupBlock: {
    oneOf: [
      tagged("text", { id: nonblank, text: string }, ["id", "text"]),
      tagged("image", { id: nonblank, src: resource, alt: string }, ["id", "src"]),
      tagged("video", { id: nonblank, src: resource, poster: string }, ["id", "src"]),
      tagged("audio", { id: nonblank, src: resource }, ["id", "src"]),
    ],
  },
  MapPresentation: object({
    mode: choice("panel", "dialog"),
    width: length,
    height: length,
    anchor: object({
      align: choice("top", "bottom", "left", "right", "top-left", "top-right", "bottom-left", "bottom-right"),
      axis: choice("horizontal", "vertical"),
      inset: { anyOf: [insetLength, object({ top: insetLength, right: insetLength, bottom: insetLength, left: insetLength })] },
    }),
  }, ["mode"]),
  MapSector: object({
    angle: { ...positive, exclusiveMaximum: 360 },
    radius: positive,
    followFov: boolean,
    color: nonblank,
    opacity: unit,
    strokeColor: nonblank,
    strokeWidth: nonnegative,
    strokeOpacity: unit,
    gradient: object({
      type: choice("radial", "linear"),
      stops: array(object({ offset: unit, color: nonblank, opacity: unit }, ["offset", "color"]), { minItems: 2 }),
    }, ["type", "stops"]),
  }, ["angle", "radius"]),
  Map: object({
    image: resource,
    interaction: choice("fixed", "zoom"),
    presentation: ref("MapPresentation"),
    controls: object({ collapse: boolean, zoom: boolean }),
    iconSize: positive,
    maxScale: { ...number, minimum: 1 },
    dragMotion: { anyOf: [{ const: false }, object({ inertia: boolean, bounce: boolean })] },
    sector: ref("MapSector"),
    spots: array(object({
      id: nonblank,
      sceneId: nonblank,
      x: { ...unit, description: "Normalized horizontal coordinate measured from the left edge." },
      y: { ...unit, description: "Normalized vertical coordinate measured from the top edge." },
      heading: { ...number, description: "Clockwise degrees from image up when viewer yaw is zero." },
      icon: resource,
    }, ["id", "sceneId", "x", "y", "heading"])),
  }, ["image", "spots"]),
  GeoMap: object({
    initialSourceId: { ...nonblank, description: "ID of a basemap source supplied by the host application." },
    presentation: ref("MapPresentation"),
    iconSize: positive,
    controlsLayout: choice("horizontal", "vertical"),
    sector: { anyOf: [{ const: false }, ref("MapSector")] },
    minZoom: zoom,
    maxZoom: zoom,
    initialZoom: zoom,
    spots: array(object({
      id: nonblank,
      sceneId: nonblank,
      positions: { ...object({ wgs84: latitudeLongitude, gcj02: latitudeLongitude, bd09: latitudeLongitude }), minProperties: 1 },
      label: nonblank,
      icon: resource,
      heading: { ...number, description: "Clockwise degrees from true north when viewer yaw is zero." },
    }, ["id", "sceneId", "positions"])),
  }, ["spots"]),
};

export const projectSchema = {
  $schema: draft,
  title: "Pano View project.json",
  description: "A loadable static panorama tour. Run parsePanoProject after schema validation to check references and semantics.",
  ...object({
    schemaVersion: version,
    title: nonblank,
    initialSceneId: { ...nonblank, description: "ID of an existing scene. Defaults to the first scene." },
    scenes: array(ref("Scene"), { minItems: 1 }),
    popups: array(ref("Popup")),
    map: ref("Map"),
    geoMap: ref("GeoMap"),
  }, ["schemaVersion", "scenes"]),
  $defs: definitions,
};
