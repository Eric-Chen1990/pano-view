import {
  parsePanoProject,
  type PanoProjectDefinition,
  type PanoProjectSceneDefinition,
  type AssetUrlResolver,
  type AssetUrlContext,
  type ViewerConfig,
} from "@ericchen1990/pano-view/data";
import { errorMessage } from "./errors";

// This origin is only a URL namespace. Every resource is resolved to a selected File,
// and no fetch is ever allowed to reach it (including for missing resources).
export const LOCAL_ROOT = "https://pano-editor.invalid/";
const MISSING_TILE =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==";

export class LocalFiles {
  readonly files = new Map<string, File>();
  private urls = new Map<string, string>();
  private configs = new Map<string, Promise<ViewerConfig>>();
  readonly issues = new Set<string>();
  private listeners = new Set<() => void>();
  private notifyPending = false;
  readonly name: string;
  static reference(path: string) {
    return path.split("/").map(encodeURIComponent).join("/");
  }
  constructor(files: readonly File[]) {
    if (!files.length) throw new Error("No files selected");
    const first = files[0]!.webkitRelativePath;
    if (!first || !first.includes("/"))
      throw new Error("Select a project directory, not individual files");
    const root = first.split("/")[0]!;
    this.name = root;
    for (const file of files) {
      if (!file.webkitRelativePath.startsWith(root + "/"))
        throw new Error("Select one project root directory");
      const path = file.webkitRelativePath.slice(root.length + 1);
      if (this.files.has(path)) throw new Error(`Duplicate resource: ${path}`);
      this.files.set(path, file);
    }
  }
  path(path: string, base = LOCAL_ROOT): string {
    const relative = path.startsWith(LOCAL_ROOT)
      ? path.slice(LOCAL_ROOT.length - 1)
      : path;
    if (!/^[a-z][a-z\d+.-]*:/i.test(relative)) {
      const parts = relative.startsWith("/")
        ? []
        : new URL(base).pathname.split("/").filter(Boolean);
      for (const segment of relative.split(/[?#]/)[0]!.split("/")) {
        const part = decodeURIComponent(segment);
        if (!part || part === ".") continue;
        if (part === "..") {
          if (!parts.length)
            throw new Error(
              `Resource is outside the selected project: ${path}`,
            );
          parts.pop();
        } else parts.push(part);
      }
    }
    const url = new URL(path, base);
    if (url.origin !== new URL(LOCAL_ROOT).origin || url.search || url.hash)
      throw new Error(`Resource is outside the selected project: ${path}`);
    return decodeURIComponent(url.pathname.slice(1));
  }
  file(path: string, base?: string): File {
    const key = this.path(path, base);
    const file = this.files.get(key);
    if (!file) throw new Error(`Missing local resource: ${key}`);
    return file;
  }
  async json(path: string): Promise<unknown> {
    try {
      return JSON.parse(await this.file(path).text()) as unknown;
    } catch (error) {
      throw new Error(
        `${path}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
  readonly resolve: AssetUrlResolver = (path, context) =>
    this.resolveFrom(path, context, LOCAL_ROOT);
  resolveFrom(
    path: string,
    { defaultUrl }: AssetUrlContext,
    base: string,
  ): string {
    this.path(path, base);
    const key = this.path(defaultUrl);
    const file = this.files.get(key);
    if (!file) throw new Error(`Missing local resource: ${key}`);
    let url = this.urls.get(key);
    if (!url) {
      url = URL.createObjectURL(file);
      this.urls.set(key, url);
    }
    return url;
  }
  viewerPaths() {
    return [...this.files.keys()]
      .filter((path) => /(^|\/)viewer\.json$/.test(path))
      .sort();
  }
  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
  tile(resolve: () => string) {
    try {
      return resolve();
    } catch (error) {
      const message = errorMessage(error);
      if (!this.issues.has(message)) {
        this.issues.add(message);
        if (!this.notifyPending) {
          this.notifyPending = true;
          queueMicrotask(() => {
            this.notifyPending = false;
            for (const listener of this.listeners) listener();
          });
        }
      }
      return MISSING_TILE;
    }
  }
  async project(): Promise<PanoProjectDefinition | undefined> {
    if (!this.files.has("project.json")) return undefined;
    return parsePanoProject(await this.json("project.json"));
  }
  async source(source: PanoProjectSceneDefinition["source"]) {
    if (source.viewerConfig)
      return {
        config: source.viewerConfig,
        baseUrl: this.directory(source.baseUrl ?? "./"),
      };
    const path = this.path(source.viewerUrl);
    let config = this.configs.get(path);
    if (!config) {
      config = this.json(LocalFiles.reference(path)).then((value) => {
        if (
          !value ||
          typeof value !== "object" ||
          !("schemaVersion" in value) ||
          value.schemaVersion !== 1
        )
          throw new Error(`${path}: unsupported viewer.json schemaVersion`);
        return parsePanoProject({
          schemaVersion: 1,
          scenes: [{ id: "validate", source: { viewerConfig: value } }],
        }).scenes[0]!.source.viewerConfig!;
      });
      this.configs.set(path, config);
      void config.catch(() => this.configs.delete(path));
    }
    return {
      config: await config,
      baseUrl: source.baseUrl
        ? this.directory(source.baseUrl)
        : new URL(".", new URL(LocalFiles.reference(path), LOCAL_ROOT)).href,
    };
  }
  private directory(path: string) {
    const key = this.path(path);
    return new URL(LocalFiles.reference(key).replace(/\/?$/, "/"), LOCAL_ROOT)
      .href;
  }
  dispose() {
    for (const url of this.urls.values()) URL.revokeObjectURL(url);
    this.urls.clear();
    this.configs.clear();
    this.listeners.clear();
    this.issues.clear();
  }
}
