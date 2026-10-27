import {
  parsePanoProject,
  type PanoProjectDefinition,
  type ProjectHotspotDefinition,
} from "@ericchen1990/pano-view/data";
import {
  validatePolygonVertices,
  validatePolylineVertices,
  type HotspotPosition,
} from "@ericchen1990/pano-view";

export const emptyProject = (): PanoProjectDefinition => ({
  schemaVersion: 1,
  scenes: [],
});
export const newId = () => crypto.randomUUID();

/** Keep empty authoring documents separate from the viewer's nonempty-project requirement. */
export function readDocument(value: unknown): PanoProjectDefinition {
  if (
    value &&
    typeof value === "object" &&
    "schemaVersion" in value &&
    value.schemaVersion === 1 &&
    "scenes" in value &&
    Array.isArray(value.scenes) &&
    value.scenes.length === 0
  ) {
    return {
      schemaVersion: 1,
      scenes: [],
      ...("title" in value &&
      typeof value.title === "string" &&
      value.title.trim()
        ? { title: value.title }
        : {}),
    };
  }
  return parsePanoProject(value);
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
      if (hotspot.type === "graphic" && hotspot.graphic.kind === "svg")
        check(hotspot.graphic.src, `${hotspot.id}.graphic.src`);
      if (typeof hotspot.tooltip === "object")
        check(hotspot.tooltip.image, `${hotspot.id}.tooltip.image`);
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
        if (hotspot.action?.sceneId !== id) return hotspot;
        const { action: _action, ...rest } = hotspot;
        return rest;
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
): ProjectHotspotDefinition {
  const common = { id: newId(), label: kind, position, width: 12, height: 12 };
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
        text: "Text",
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
        id: common.id,
        label: kind,
        type: kind,
        vertices: [],
        fill: "#df6b42",
        fillOpacity: 0.3,
        stroke: "#ffffff",
        strokeWidth: 2,
      };
    case "polyline":
      return {
        id: common.id,
        label: kind,
        type: kind,
        vertices: [],
        stroke: "#75cbd3",
        strokeWidth: 2,
      };
  }
}
