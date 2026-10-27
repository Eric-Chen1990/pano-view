import {
  loadPanoProject,
  sceneFromViewerConfig,
  type LoadedProjectScene,
  type LoadPanoProjectOptions,
  type PanoProjectSceneDefinition,
} from "@ericchen1990/pano-view/data";
import { LocalFiles } from "./local-files";

export function projectRoot(baseUrl?: string): string {
  const url = new URL(
    baseUrl ?? "./",
    typeof document === "undefined" ? undefined : document.baseURI,
  );
  url.search = "";
  url.hash = "";
  if (!url.pathname.endsWith("/")) url.pathname += "/";
  return url.href;
}

export class SceneSources {
  private cache = new Map<
    string,
    {
      signal: AbortSignal;
      promise: Promise<LoadedProjectScene["scene"]>;
      ready: boolean;
    }
  >();
  constructor(
    private options: LoadPanoProjectOptions,
    private local?: LocalFiles,
  ) {}
  load(
    id: string,
    source: PanoProjectSceneDefinition["source"],
    signal: AbortSignal,
  ) {
    const key = JSON.stringify([id, source]);
    const cached = this.cache.get(key);
    if (cached && (cached.ready || !cached.signal.aborted))
      return cached.promise;
    const promise = this.read(id, source, signal);
    const entry = { signal, promise, ready: false };
    this.cache.set(key, entry);
    void promise.then(
      () => {
        entry.ready = true;
      },
      () => {},
    );
    void promise.catch(() => {
      if (this.cache.get(key) === entry) this.cache.delete(key);
    });
    return promise;
  }
  private async read(
    id: string,
    source: PanoProjectSceneDefinition["source"],
    signal: AbortSignal,
  ): Promise<LoadedProjectScene["scene"]> {
    if (this.local) {
      const { config, baseUrl } = await this.local.source(source);
      signal.throwIfAborted();
      const scene = sceneFromViewerConfig(config, {
        id,
        baseUrl,
        resolveAssetUrl: (path, context) =>
          this.local!.resolveFrom(path, context, baseUrl),
      });
      const local = this.local;
      if (scene.type === "tile") {
        const resolve = scene.resolveTileUrl!;
        scene.resolveTileUrl = (address) => local.tile(() => resolve(address));
      } else {
        const resolve = scene.resolveTileUrl!;
        scene.resolveTileUrl = (address) => local.tile(() => resolve(address));
      }
      return scene;
    }
    const external = this.options.requestInit?.signal;
    const project = await loadPanoProject(
      { schemaVersion: 1, scenes: [{ id, source }] },
      {
        ...this.options,
        baseUrl: projectRoot(this.options.baseUrl),
        requestInit: {
          ...this.options.requestInit,
          signal: external ? AbortSignal.any([signal, external]) : signal,
        },
      },
    );
    return project.scenes[0]!.scene;
  }
}
