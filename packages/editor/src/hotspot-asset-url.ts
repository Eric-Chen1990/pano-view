import type { AssetUrlResolver } from "@ericchen1990/pano-view/data";
import { LOCAL_ROOT, type LocalFiles } from "./local-files";

export function resolveEditorHotspotAsset(
  path: string,
  context: Parameters<AssetUrlResolver>[1],
  files: LocalFiles | undefined,
  resolveAssetUrl: AssetUrlResolver | undefined,
) {
  return files
    ? files.resolve(path, { ...context, defaultUrl: new URL(path, LOCAL_ROOT).href })
    : resolveAssetUrl?.(path, context) ?? context.defaultUrl;
}
