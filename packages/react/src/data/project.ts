import { parsePopups, resolveProjectPopupAssets, type ProjectPopupDefinition, type PopupAssetUrlResolver } from "./popups";
import {
  isRecord,
  requiredString,
  type ViewerConfig,
} from "../../../../shared/viewer-config";
import type { TileScene, SphereTileScene } from "../scenes";
import type { PanoViewerState } from "../types";
import { PanoDataError, aborted } from "./errors";
import {
  parseHotspot,
  parsePosition,
  resolveHotspotAssets,
  type ProjectHotspotDefinition,
} from "./hotspots";
import {
  documentUrl,
  directoryUrl,
  readJson,
  parseConfig,
  resolveResource,
  sceneFromViewerConfig,
  loadSceneFromJson,
  type AssetUrlResolver,
  type JsonRequestOptions,
} from "./viewer";

export type PanoProjectSceneDefinition = {
  id: string;
  title?: string;
  source: (
    | { viewerUrl: string; viewerConfig?: never }
    | { viewerConfig: ViewerConfig; viewerUrl?: never }
  ) & { baseUrl?: string };
  initialView?: Partial<PanoViewerState>;
  hotspots?: ProjectHotspotDefinition[];
};
export type PanoProjectDefinition = {
  schemaVersion: 1;
  title?: string;
  initialSceneId?: string;
  scenes: PanoProjectSceneDefinition[];
  popups?: ProjectPopupDefinition[];
};
export type LoadedProjectScene = {
  scene: TileScene | SphereTileScene;
  title?: string;
  initialView?: PanoViewerState;
  hotspots: ProjectHotspotDefinition[];
};
export type LoadedPanoProject = {
  title?: string;
  initialSceneId: string;
  scenes: LoadedProjectScene[];
  popups?: ProjectPopupDefinition[];
};
export type LoadPanoProjectOptions = JsonRequestOptions & {
  /** Directory used for project-relative references. Required for object input. */
  baseUrl?: string;
  resolveAssetUrl?: AssetUrlResolver;
  resolvePopupAssetUrl?: PopupAssetUrlResolver;
};

function optionalString(
  record: Record<string, unknown>,
  key: string
): string | undefined {
  return record[key] === undefined
    ? undefined
    : requiredString(record[key], key);
}

/** Drafts permit empty scenes and unfinished popup titles/media; loading and export always validate strictly. */
export function parsePanoProject(value: unknown, options: { draft?: boolean } = {}): PanoProjectDefinition {
  if (!isRecord(value))
    throw new PanoDataError("INVALID_PROJECT", "Expected a project object");
  if (value.schemaVersion !== 1)
    throw new PanoDataError(
      "UNSUPPORTED_SCHEMA_VERSION",
      "Unsupported project schemaVersion",
      { field: "schemaVersion" }
    );
  try {
    const popups = parsePopups(value.popups, options.draft);
    if (!Array.isArray(value.scenes) || (!options.draft && !value.scenes.length))
      throw new Error("scenes: expected a nonempty array");
    const ids = new Set<string>();
    const scenes = value.scenes.map(
      (entry: unknown, index): PanoProjectSceneDefinition => {
        let id: string | undefined;
        const field = `scenes[${index}]`;
        try {
          if (!isRecord(entry)) throw new Error("expected a scene object");
          id = requiredString(entry.id, "id");
          if (ids.has(id)) throw new Error("id: duplicate scene ID");
          ids.add(id);
          if (!isRecord(entry.source))
            throw new Error("source: expected an object");
          const src = entry.source;
          if (
            (src.viewerUrl !== undefined) ===
            (src.viewerConfig !== undefined)
          )
            throw new Error(
              "source: provide exactly one of viewerUrl or viewerConfig"
            );
          const baseUrl = optionalString(src, "baseUrl");
          const source: PanoProjectSceneDefinition["source"] =
            src.viewerUrl !== undefined
              ? {
                  viewerUrl: requiredString(src.viewerUrl, "source.viewerUrl"),
                  baseUrl,
                }
              : { viewerConfig: parseConfig(src.viewerConfig), baseUrl };
          let initialView: Partial<PanoViewerState> | undefined;
          if (entry.initialView !== undefined) {
            if (!isRecord(entry.initialView))
              throw new Error("initialView: expected an object");
            const input = entry.initialView;
            const position = parsePosition(
              { yaw: input.yaw ?? 0, pitch: input.pitch ?? 0 },
              "initialView"
            );
            const fov = input.fov ?? 75;
            if (
              typeof fov !== "number" ||
              !Number.isFinite(fov) ||
              fov <= 0 ||
              fov >= 180
            )
              throw new Error(
                "initialView.fov: expected a number between 0 and 180"
              );
            initialView = { ...position, fov };
          }
          if (entry.hotspots !== undefined && !Array.isArray(entry.hotspots))
            throw new Error("hotspots: expected an array");
          const hotspotIds = new Set<string>();
          const hotspots = ((entry.hotspots ?? []) as unknown[]).map(
            (hotspot, i) => {
              const result = parseHotspot(
                hotspot,
                id!,
                `${field}.hotspots[${i}]`
              );
              if (hotspotIds.has(result.id))
                throw new Error(`hotspots[${i}].id: duplicate hotspot ID`);
              hotspotIds.add(result.id);
              return result;
            }
          );
          return {
            id,
            title: optionalString(entry, "title"),
            source,
            initialView,
            hotspots,
          };
        } catch (cause) {
          if (cause instanceof PanoDataError && cause.sceneId) throw cause;
          const detail =
            cause instanceof Error ? cause.message : "Invalid scene";
          throw new PanoDataError(
            cause instanceof PanoDataError ? cause.code : "INVALID_PROJECT",
            `${field}.${detail}`,
            {
              sceneId: id,
              field: `${field}.${
                cause instanceof PanoDataError
                  ? `source.viewerConfig.${cause.field ?? ""}`
                  : detail.split(":")[0]
              }`,
              cause,
            }
          );
        }
      }
    );
    const initialSceneId =
      optionalString(value, "initialSceneId") ?? scenes[0]?.id;
    if (initialSceneId !== undefined && !ids.has(initialSceneId))
      throw new PanoDataError(
        "INVALID_REFERENCE",
        "initialSceneId: scene does not exist",
        { field: "initialSceneId" }
      );
    for (const [index, scene] of scenes.entries()) {
      for (const [i, hotspot] of (scene.hotspots ?? []).entries()) {
        const action = hotspot.action;
        if (action?.type === "popup" && !popups?.some((popup) => popup.id === action.popupId))
          throw new PanoDataError("INVALID_REFERENCE", "Hotspot target popup does not exist", {
            sceneId: scene.id, field: `scenes[${index}].hotspots[${i}].action.popupId`,
          });
        if (hotspot.action?.type === "scene" && !ids.has(hotspot.action.sceneId))
          throw new PanoDataError(
            "INVALID_REFERENCE",
            "Hotspot target scene does not exist",
            {
              sceneId: scene.id,
              field: `scenes[${index}].hotspots[${i}].action.sceneId`,
            }
          );
      }
    }
    return {
      schemaVersion: 1,
      title: optionalString(value, "title"),
      initialSceneId,
      scenes,
      ...(popups === undefined ? {} : { popups }),
    };
  } catch (cause) {
    if (cause instanceof PanoDataError) throw cause;
    const message = cause instanceof Error ? cause.message : "Invalid project";
    throw new PanoDataError("INVALID_PROJECT", message, {
      cause,
      field: message.split(":")[0],
    });
  }
}

export async function loadPanoProject(
  source: string | PanoProjectDefinition,
  options: LoadPanoProjectOptions = {}
): Promise<LoadedPanoProject> {
  aborted(options.requestInit?.signal);
  let definition: PanoProjectDefinition;
  let baseUrl: string;
  if (typeof source === "string") {
    const response = await readJson(documentUrl(source), options);
    definition = parsePanoProject(response.value);
    baseUrl = options.baseUrl ?? new URL(".", response.url).href;
  } else {
    if (!options.baseUrl)
      throw new PanoDataError(
        "INVALID_OPTIONS",
        "baseUrl is required for project object input"
      );
    definition = parsePanoProject(source);
    baseUrl = options.baseUrl;
  }
  const root = directoryUrl(documentUrl(baseUrl));
  const controller = new AbortController();
  const signal = options.requestInit?.signal;
  const cancel = () => controller.abort();
  signal?.addEventListener("abort", cancel, { once: true });
  const scenes: LoadedProjectScene[] = new Array(definition.scenes.length);
  let next = 0;
  let failure: PanoDataError | undefined;
  async function worker() {
    while (next < definition.scenes.length && !controller.signal.aborted) {
      const index = next++;
      const item = definition.scenes[index]!;
      try {
        const sourceBase =
          item.source.baseUrl === undefined
            ? undefined
            : resolveResource(root, item.source.baseUrl);
        const sceneOptions = {
          id: item.id,
          resolveAssetUrl: options.resolveAssetUrl,
        };
        const scene =
          item.source.viewerUrl !== undefined
            ? await loadSceneFromJson(
                resolveResource(root, item.source.viewerUrl),
                {
                  ...sceneOptions,
                  baseUrl: sourceBase,
                  requestInit: {
                    ...options.requestInit,
                    signal: controller.signal,
                  },
                }
              )
            : sceneFromViewerConfig(item.source.viewerConfig, {
                ...sceneOptions,
                baseUrl: sourceBase ?? root,
              });
        aborted(controller.signal);
        scenes[index] = {
          scene,
          title: item.title,
          initialView: item.initialView
            ? { yaw: 0, pitch: 0, fov: 75, ...item.initialView }
            : undefined,
          hotspots: item.hotspots!.map((h) =>
            resolveHotspotAssets(h, root, item.id, options.resolveAssetUrl)
          ),
        };
      } catch (cause) {
        if (!failure) {
          const error =
            cause instanceof PanoDataError
              ? cause
              : new PanoDataError(
                  "INVALID_CONFIG",
                  cause instanceof Error
                    ? cause.message
                    : "Could not load scene",
                  { cause }
                );
          const field = `scenes[${index}].${
            error.field ??
            (item.source.viewerUrl !== undefined
              ? "source.viewerUrl"
              : "source.viewerConfig")
          }`;
          failure = new PanoDataError(
            error.code,
            `Scene ${item.id}: ${error.message}`,
            { status: error.status, sceneId: item.id, field, cause: error }
          );
        }
        controller.abort();
      }
    }
  }
  try {
    aborted(signal);
    await Promise.all(
      Array.from({ length: Math.min(4, scenes.length) }, worker)
    );
    aborted(signal);
    if (failure) throw failure;
    return {
      title: definition.title,
      initialSceneId: definition.initialSceneId!,
      scenes,
      ...(definition.popups === undefined ? {} : { popups: definition.popups.map((popup) => resolveProjectPopupAssets(popup, root, options.resolvePopupAssetUrl)) }),
    };
  } finally {
    signal?.removeEventListener("abort", cancel);
  }
}
