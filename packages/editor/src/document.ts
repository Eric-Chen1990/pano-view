import { hotspotAction, setHotspotAction, projectHotspotTriggers } from "@ericchen1990/pano-view/data";
import { mapCursorAssets } from "../../../shared/cursor-assets";
import {
  parsePanoProject,
  type PanoProjectDefinition,
  type ProjectHotspotDefinition,
} from "@ericchen1990/pano-view/data";
import {
  validatePolygonVertices,
  validatePolylineVertices,
  DEFAULT_HOTSPOT_TOOLTIP_OFFSET,
  type HotspotPosition,
} from "@ericchen1990/pano-view";
import { translator, type Translate } from "./i18n";

export const emptyProject = (): PanoProjectDefinition => ({
  schemaVersion: 1,
  scenes: [],
});
export const newId = () => crypto.randomUUID();

/** Keep empty authoring documents separate from the viewer's nonempty-project requirement. */
export function readDocument(value: unknown): PanoProjectDefinition {
  const empty = value && typeof value === "object" && "scenes" in value && Array.isArray(value.scenes) && value.scenes.length === 0;
  const input = empty ? { ...value, title: "title" in value && typeof value.title === "string" && value.title.trim() ? value.title : undefined } : value;
  const parsed = parsePanoProject(input, { draft: true });
  return empty ? { schemaVersion: 1, scenes: [], ...(parsed.title ? { title: parsed.title } : {}), ...(parsed.popups === undefined ? {} : { popups: parsed.popups }) } : parsed;
}

export function geometryIssue(
  hotspot: ProjectHotspotDefinition,
): string | undefined {
  if (hotspot.type === "polygon")
    return validatePolygonVertices(hotspot.vertices)[0]?.message;
  if (hotspot.type === "polyline")
    return validatePolylineVertices(hotspot.vertices)[0]?.message;
}

export function exportDocument(project: PanoProjectDefinition): string {
  const parsed = parsePanoProject(project);
  function check(value: unknown, field: string) {
    if (
      typeof value === "string" &&
      /^(blob:|file:|[a-z]:\\|https:\/\/pano-editor\.invalid(?:\/|$))/i.test(
        value,
      )
    )
      throw new Error(
        `${field}: temporary or local machine URLs cannot be exported`,
      );
    if (Array.isArray(value))
      value.forEach((item, i) => check(item, `${field}[${i}]`));
    else if (value && typeof value === "object")
      Object.entries(value).forEach(([key, item]) =>
        check(item, `${field}.${key}`),
      );
  }
  // Text and labels can contain arbitrary prose; only resource fields are checked.
  for (const scene of parsed.scenes) {
    check(scene.source, `scenes.${scene.id}.source`);
    for (const hotspot of scene.hotspots ?? []) {
      const issue = geometryIssue(hotspot);
      if (issue) throw new Error(`${scene.id}/${hotspot.id}: ${issue}`);
      for (const field of ["src", "poster", "icon", "playingIcon"] as const) {
        if (field in hotspot)
          check(
            hotspot[field as keyof typeof hotspot],
            `${hotspot.id}.${field}`,
          );
      }
      if (hotspot.cursor) mapCursorAssets(hotspot.cursor, (path) => { check(path, `${hotspot.id}.cursor`); return path; });
      if (hotspot.tooltipAppearance?.background) mapCursorAssets(hotspot.tooltipAppearance.background, path => { check(path, `${hotspot.id}.tooltipAppearance.background`); return path; });
      if (hotspot.type === "graphic" && hotspot.graphic.kind === "svg")
        check(hotspot.graphic.src, `${hotspot.id}.graphic.src`);
      if (typeof hotspot.tooltip === "object")
        check(hotspot.tooltip.image, `${hotspot.id}.tooltip.image`);
    }
  }
  for (const popup of parsed.popups ?? []) {
    for (const block of popup.blocks) {
      if (block.type !== "text") check(block.src, `popups.${popup.id}.${block.id}.src`);
      if (block.type === "video" && block.poster) check(block.poster, `popups.${popup.id}.${block.id}.poster`);
    }
  }
  return JSON.stringify(parsed, null, 2) + "\n";
}

export function removeScene(
  project: PanoProjectDefinition,
  id: string,
): PanoProjectDefinition {
  const scenes = project.scenes
    .filter((scene) => scene.id !== id)
    .map((scene) => ({
      ...scene,
      hotspots: scene.hotspots?.map((hotspot) => {
        let next = hotspot;
        for (const trigger of projectHotspotTriggers) {
          const action = hotspotAction(next, trigger);
          if (action?.type === "scene" && action.sceneId === id) next = setHotspotAction(next, trigger);
        }
        // Remove a shadowed legacy reference too.
        if (next.action?.type === "scene" && next.action.sceneId === id) { next = { ...next }; delete next.action; }
        return next;
      }),
    }));
  return {
    ...project,
    scenes,
    initialSceneId:
      project.initialSceneId === id ? scenes[0]?.id : project.initialSceneId,
  };
}

export type HotspotKind = ProjectHotspotDefinition["type"];
export function moveScene(
  project: PanoProjectDefinition,
  id: string,
  beforeId?: string,
): PanoProjectDefinition {
  const sourceIndex = project.scenes.findIndex((scene) => scene.id === id);
  if (sourceIndex < 0 || beforeId === id) return project;
  const scenes = project.scenes.filter((scene) => scene.id !== id);
  const targetIndex = beforeId === undefined
    ? scenes.length
    : scenes.findIndex((scene) => scene.id === beforeId);
  if (targetIndex < 0 || targetIndex === sourceIndex) return project;
  scenes.splice(targetIndex, 0, project.scenes[sourceIndex]!);
  return { ...project, scenes };
}

export const hotspotKinds: HotspotKind[] = [
  "graphic",
  "text",
  "image",
  "sequence",
  "video",
  "audio",
  "iframe",
  "polygon",
  "polyline",
];

export function createHotspot(
  kind: HotspotKind,
  position: HotspotPosition,
  src = "",
  options: { hotspots?: ProjectHotspotDefinition[]; t?: Translate } = {},
): ProjectHotspotDefinition {
  const t = options.t ?? translator("en");
  const typeName = t(kind);
  const name = typeName.charAt(0).toUpperCase() + typeName.slice(1);
  const names = new Set(options.hotspots?.map((hotspot) => hotspot.label));
  let index = 1;
  while (names.has(`${name} ${index}`)) index += 1;
  const label = `${name} ${index}`;
  const metadata = {
    id: newId(),
    label,
    ...(kind === "text" ? {} : { tooltip: label }),
    tooltipTrigger: "always" as const,
    tooltipPlacement: "top" as const,
    tooltipOffset: DEFAULT_HOTSPOT_TOOLTIP_OFFSET,
  };
  const common = { ...metadata, position, width: 12, height: 12 };
  switch (kind) {
    case "graphic":
      return {
        ...common,
        type: kind,
        graphic: {
          kind: "arrow",
          fill: "#df6b42",
          stroke: "#ffffff",
          strokeWidth: 5,
        },
      };
    case "text":
      return {
        ...common,
        type: kind,
        text: t("Text"),
        width: 30,
        height: 10,
        fontSize: 32,
        color: "#ffffff",
      };
    case "image":
      return { ...common, type: kind, src };
    case "sequence":
      return { ...common, type: kind, src, frameCount: 1, fps: 12, loop: true };
    case "video":
      return { ...common, type: kind, src, muted: true, loop: false };
    case "audio":
      return { ...common, type: kind, src, marker: true, volume: 1 };
    case "iframe":
      return {
        ...common,
        type: kind,
        src,
        title: "Content",
        sandbox: "",
        pointerPolicy: "hotspot",
      };
    case "polygon":
      return {
        ...metadata,
        type: kind,
        vertices: [],
        fill: "#df6b42",
        fillOpacity: 0.3,
        stroke: "#ffffff",
        strokeWidth: 2,
      };
    case "polyline":
      return {
        ...metadata,
        type: kind,
        vertices: [],
        stroke: "#75cbd3",
        strokeWidth: 2,
      };
  }
}

export function popupReferences(project: PanoProjectDefinition, popupId: string) {
  return project.scenes.flatMap(scene => (scene.hotspots ?? []).flatMap(hotspot => projectHotspotTriggers.flatMap(trigger => {
    const action = hotspotAction(hotspot, trigger);
    return action?.type === "popup" && action.popupId === popupId ? [{ sceneId: scene.id, hotspotId: hotspot.id, trigger, label: `${scene.title ?? scene.id} / ${hotspot.label || hotspot.id} / ${trigger}` }] : [];
  })));
}
export function removePopup(project: PanoProjectDefinition, popupId: string): PanoProjectDefinition {
  if (popupReferences(project, popupId).length) throw new Error("Unlink this popup from its hotspots before deleting it.");
  return { ...project, popups: project.popups?.filter((popup) => popup.id !== popupId) };
}
