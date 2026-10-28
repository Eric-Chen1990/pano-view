import { isRecord, requiredString } from "../../../../shared/viewer-config";
import { PanoDataError } from "./errors";
import { resolveResource } from "./viewer";

export type ProjectPopupBlock = { id: string } & (
  | { type: "text"; text: string }
  | { type: "image"; src: string; alt?: string }
  | { type: "video"; src: string; poster?: string }
  | { type: "audio"; src: string }
);
export type ProjectPopupDefinition = {
  id: string;
  title: string;
  blocks: ProjectPopupBlock[];
};
export type PopupAssetUrlContext = {
  defaultUrl: string;
  popupId: string;
  blockId: string;
  field: "src" | "poster";
};
export type PopupAssetUrlResolver = (path: string, context: PopupAssetUrlContext) => string;

export function parsePopups(value: unknown, draft = false): ProjectPopupDefinition[] | undefined {
  if (value === undefined) return undefined;
  try {
    if (!Array.isArray(value)) throw new Error("popups: expected an array");
    const ids = new Set<string>();
    const string = (input: unknown, field: string, allowEmpty = false) => {
      if (typeof input !== "string" || (!allowEmpty && !input.trim()))
        throw new Error(`${field}: expected a ${allowEmpty ? "string" : "nonempty string"}`);
      return input;
    };
    return value.map((entry, index) => {
      const field = `popups[${index}]`;
      if (!isRecord(entry)) throw new Error(`${field}: expected an object`);
      const id = requiredString(entry.id, `${field}.id`);
      if (ids.has(id)) throw new Error(`${field}.id: duplicate popup ID`);
      ids.add(id);
      const title = string(entry.title, `${field}.title`, draft);
      if (!Array.isArray(entry.blocks)) throw new Error(`${field}.blocks: expected an array`);
      const blockIds = new Set<string>();
      const blocks = entry.blocks.map((block, i): ProjectPopupBlock => {
        const path = `${field}.blocks[${i}]`;
        if (!isRecord(block)) throw new Error(`${path}: expected an object`);
        const id = requiredString(block.id, `${path}.id`);
        if (blockIds.has(id)) throw new Error(`${path}.id: duplicate block ID`);
        blockIds.add(id);
        if (block.type === "text") return { id, type: "text", text: string(block.text, `${path}.text`, true) };
        const src = string(block.src, `${path}.src`, draft);
        if (src) resolveResource("https://popup.invalid/", src);
        if (block.type === "image") return {
          id, type: "image", src,
          ...(block.alt === undefined ? {} : { alt: string(block.alt, `${path}.alt`, true) }),
        };
        if (block.type === "audio") return { id, type: "audio", src };
        if (block.type === "video") {
          const poster = block.poster === undefined ? undefined : string(block.poster, `${path}.poster`, true);
          if (poster) resolveResource("https://popup.invalid/", poster);
          return { id, type: "video", src, ...(poster ? { poster } : {}) };
        }
        throw new Error(`${path}.type: unsupported content block`);
      });
      return { id, title, blocks };
    });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Invalid popup content";
    throw new PanoDataError("INVALID_PROJECT", message, { field: message.split(":")[0], cause });
  }
}

export function resolveProjectPopupAssets(
  popup: ProjectPopupDefinition,
  baseUrl: string,
  resolver?: PopupAssetUrlResolver,
): ProjectPopupDefinition {
  return { ...popup, blocks: popup.blocks.map((block) => {
    if (block.type === "text") return { ...block };
    const resolve = (path: string, field: "src" | "poster") => {
      if (!path) throw new PanoDataError("INVALID_PROJECT", `${popup.id}/${block.id}.${field}: choose a resource`);
      const context = { defaultUrl: resolveResource(baseUrl, path), popupId: popup.id, blockId: block.id, field };
      const result = resolver ? resolver(path, context) : context.defaultUrl;
      if (typeof result !== "string" || (!result.startsWith("/") && !/^(https?:|blob:|data:)/i.test(result)))
        throw new PanoDataError("INVALID_CONFIG", "resolvePopupAssetUrl must return an absolute URL or a site-root path");
      return result;
    };
    return { ...block, src: resolve(block.src, "src"), ...(block.type === "video" && block.poster ? { poster: resolve(block.poster, "poster") } : {}) };
  }) };
}
