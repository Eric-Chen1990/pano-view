import {
  isRecord,
  validateViewerConfig,
  type ViewerConfig,
} from "../../../../shared/viewer-config";
import type { TileScene, SphereTileScene } from "../scenes";
import type { TileAddress } from "../tile/types";
import type { SphereTileAddress } from "../sphere-tile/types";
import { resolveTemplateUrl } from "../tile/multires";
import { PanoDataError, aborted } from "./errors";

export type AssetUrlContext = {
  defaultUrl: string;
  kind: "tile" | "preview" | "hotspot";
  sceneId: string;
  hotspotId?: string;
};
export type AssetUrlResolver = (
  path: string,
  context: AssetUrlContext
) => string;
export type JsonRequestOptions = {
  requestInit?: Pick<RequestInit, "headers" | "credentials" | "signal">;
};
export type SceneFromViewerConfigOptions = {
  id: string;
  baseUrl: string;
  resolveAssetUrl?: AssetUrlResolver;
};
export type LoadSceneFromJsonOptions = Omit<
  SceneFromViewerConfigOptions,
  "baseUrl"
> &
  JsonRequestOptions & { baseUrl?: string };

/** URL resolution is intentionally independent of React and browser globals on the server. */
export function documentUrl(input: string): string {
  try {
    const url = new URL(
      input,
      typeof document === "undefined" ? undefined : document.baseURI
    );
    if (url.protocol !== "http:" && url.protocol !== "https:")
      throw new Error("Use HTTP(S)");
    return url.href;
  } catch (cause) {
    throw new PanoDataError(
      "INVALID_OPTIONS",
      "Expected an HTTP(S) URL; Node.js requires an absolute URL",
      { cause }
    );
  }
}

export function directoryUrl(input: string): string {
  const url = new URL(input);
  url.search = "";
  url.hash = "";
  if (!url.pathname.endsWith("/")) url.pathname += "/";
  return url.href;
}

export function resolveResource(baseUrl: string, path: string): string {
  try {
    const url = new URL(path, directoryUrl(baseUrl));
    if (!["http:", "https:", "blob:", "data:"].includes(url.protocol))
      throw new Error("Unsupported resource URL protocol");
    return url.href;
  } catch (cause) {
    throw new PanoDataError(
      "INVALID_CONFIG",
      `Invalid resource path: ${path}`,
      { cause }
    );
  }
}

export function mapResource(
  path: string,
  context: AssetUrlContext,
  resolver?: AssetUrlResolver
): string {
  let result: string;
  try {
    result = resolver ? resolver(path, context) : context.defaultUrl;
  } catch (cause) {
    throw new PanoDataError("INVALID_CONFIG", "resolveAssetUrl failed", {
      sceneId: context.sceneId,
      cause,
    });
  }
  if (typeof result !== "string" || !result.trim())
    throw new PanoDataError(
      "INVALID_CONFIG",
      "resolveAssetUrl must return a nonempty final URL",
      { sceneId: context.sceneId }
    );
  // A root path is already final; relative callback results are ambiguous and rejected.
  if (!result.startsWith("/") && !/^(https?:|blob:|data:)/i.test(result))
    throw new PanoDataError(
      "INVALID_CONFIG",
      "resolveAssetUrl must return an absolute URL or a site-root path",
      { sceneId: context.sceneId }
    );
  return result;
}

export function parseConfig(value: unknown): ViewerConfig {
  if (isRecord(value) && value.type !== "tile" && value.type !== "sphereTile")
    throw new PanoDataError(
      "UNSUPPORTED_PROJECTION",
      "Expected a tile or sphereTile configuration",
      { field: "type" }
    );
  try {
    return validateViewerConfig(value);
  } catch (cause) {
    const message =
      cause instanceof Error ? cause.message : "Invalid viewer configuration";
    throw new PanoDataError("INVALID_CONFIG", message, {
      cause,
      field: message.split(":")[0],
    });
  }
}

export function sceneFromViewerConfig(
  value: unknown,
  options: SceneFromViewerConfigOptions
): TileScene | SphereTileScene {
  if (
    !options ||
    typeof options.id !== "string" ||
    !options.id.trim() ||
    typeof options.baseUrl !== "string" ||
    !options.baseUrl.trim()
  )
    throw new PanoDataError("INVALID_OPTIONS", "id and baseUrl are required");
  const config = parseConfig(value);
  const baseUrl = directoryUrl(documentUrl(options.baseUrl));
  const resolve = (path: string, kind: "tile" | "preview") =>
    mapResource(
      path,
      {
        kind,
        sceneId: options.id,
        defaultUrl: resolveResource(baseUrl, path),
      },
      options.resolveAssetUrl
    );
  const previewUrl = resolve(config.previewUrl, "preview");
  if (config.type === "tile") {
    return {
      ...config,
      id: options.id,
      baseUrl,
      previewUrl,
      ...(options.resolveAssetUrl
        ? {
            resolveTileUrl: (address: TileAddress) =>
              resolve(resolveTemplateUrl(config.urlTemplate, address), "tile"),
          }
        : {}),
    };
  }
  return {
    ...config,
    id: options.id,
    baseUrl,
    previewUrl,
    ...(options.resolveAssetUrl
      ? {
          resolveTileUrl: (address: SphereTileAddress) => {
            // Sphere callbacks use logical zero-based addresses; the document controls storage indices.
            const path = resolveTemplateUrl(config.urlTemplate, {
              face: "f",
              level: address.level + config.indexBase,
              row: address.row + config.indexBase,
              col: address.col + config.indexBase,
            });
            return resolve(path, "tile");
          },
        }
      : {}),
  };
}

export async function readJson(
  url: string,
  options: JsonRequestOptions
): Promise<{ value: unknown; url: string }> {
  const signal = options.requestInit?.signal;
  aborted(signal);
  let response: Response;
  try {
    response = await fetch(url, { ...options.requestInit, method: "GET" });
  } catch (cause) {
    aborted(signal);
    throw new PanoDataError(
      "FETCH_FAILED",
      "Could not fetch JSON; check the network and server CORS settings",
      { cause }
    );
  }
  aborted(signal);
  if (!response.ok)
    throw new PanoDataError(
      "HTTP_ERROR",
      `JSON request returned HTTP ${response.status}`,
      { status: response.status }
    );
  try {
    const value: unknown = await response.json();
    aborted(signal);
    return { value, url: response.url || url };
  } catch (cause) {
    aborted(signal);
    throw new PanoDataError(
      "INVALID_JSON",
      "Expected JSON; check for an HTML fallback or login page",
      { cause }
    );
  }
}

export async function loadSceneFromJson(
  url: string,
  options: LoadSceneFromJsonOptions
): Promise<TileScene | SphereTileScene> {
  if (!options || typeof options.id !== "string" || !options.id.trim())
    throw new PanoDataError("INVALID_OPTIONS", "id is required");
  const response = await readJson(documentUrl(url), options);
  if (!isRecord(response.value))
    throw new PanoDataError(
      "INVALID_CONFIG",
      "viewer.json must contain an object"
    );
  if (response.value.schemaVersion !== 1)
    throw new PanoDataError(
      "UNSUPPORTED_SCHEMA_VERSION",
      "Unsupported viewer.json schemaVersion",
      { field: "schemaVersion" }
    );
  return sceneFromViewerConfig(response.value, {
    ...options,
    baseUrl: options.baseUrl ?? new URL(".", response.url).href,
  });
}
