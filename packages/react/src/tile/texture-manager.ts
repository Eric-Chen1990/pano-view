import {
  ClampToEdgeWrapping,
  LinearFilter,
  SRGBColorSpace,
  Texture,
  TextureLoader,
} from "three";
import type {
  TextureEntrySnapshot,
  TileAddress,
  TileLoadError,
  TileLoadProgress,
} from "./types";

type Listener = (snapshot: TextureEntrySnapshot) => void;

type TextureEntry = TextureEntrySnapshot & {
  key: string;
  url: string;
  address: TileAddress;
  refs: number;
  listeners: Set<Listener>;
  lastUsed: number;
  bytes: number;
};

type TextureManagerOptions = {
  anisotropy: number;
  maxBytes: number;
  concurrency: number;
  retryCount: number;
  onProgress?: (progress: TileLoadProgress) => void;
  onError?: (event: TileLoadError) => void;
};

const EMPTY_TEXTURE_SNAPSHOT: TextureEntrySnapshot = {
  status: "idle",
  texture: null,
  error: null,
};

export class TileTextureManager {
  private readonly loader = new TextureLoader();
  private readonly entries = new Map<string, TextureEntry>();
  private readonly queue: TextureEntry[] = [];
  private activeLoads = 0;
  private totalBytes = 0;
  private requested = 0;
  private loaded = 0;
  private failed = 0;
  private disposed = false;
  private generation = 0;
  private options: TextureManagerOptions;

  constructor(options: TextureManagerOptions) {
    this.options = options;
  }

  resume() {
    this.disposed = false;
    this.drain();
  }

  getSnapshot(key: string): TextureEntrySnapshot {
    const entry = this.entries.get(key);
    return entry ? this.snapshot(entry) : EMPTY_TEXTURE_SNAPSHOT;
  }

  acquire(
    key: string,
    url: string,
    address: TileAddress,
    listener: Listener,
  ): () => void {
    let entry = this.entries.get(key);
    if (!entry) {
      entry = {
        key,
        url,
        address,
        status: "idle",
        texture: null,
        error: null,
        refs: 0,
        listeners: new Set(),
        lastUsed: performance.now(),
        bytes: 0,
      };
      this.entries.set(key, entry);
    }

    entry.refs += 1;
    entry.lastUsed = performance.now();
    entry.listeners.add(listener);
    listener(this.snapshot(entry));

    if (entry.status === "idle") {
      entry.status = "queued";
      this.queue.push(entry);
      this.requested += 1;
      this.emitProgress();
      this.drain();
    }

    return () => {
      entry!.listeners.delete(listener);
      entry!.refs = Math.max(0, entry!.refs - 1);
      entry!.lastUsed = performance.now();

      if (entry!.refs === 0 && entry!.status === "queued") {
        const queueIndex = this.queue.indexOf(entry!);
        if (queueIndex >= 0) {
          this.queue.splice(queueIndex, 1);
        }
        entry!.status = "idle";
        this.entries.delete(entry!.key);
        this.requested = Math.max(0, this.requested - 1);
        this.emitProgress();
        this.drain();
        return;
      }

      this.evict();
    };
  }

  dispose() {
    this.disposed = true;
    this.generation += 1;
    this.queue.length = 0;
    for (const entry of this.entries.values()) {
      entry.texture?.dispose();
      entry.listeners.clear();
    }
    this.entries.clear();
    this.totalBytes = 0;
  }

  /**
   * Releases textures that are no longer rendered by any Tile instance.
   * Scene transitions call this after the outgoing panorama has been
   * snapshotted, so the incoming scene never competes with stale GPU tiles.
   */
  releaseUnused() {
    for (const entry of Array.from(this.entries.values())) {
      if (entry.refs > 0) {
        continue;
      }
      entry.texture?.dispose();
      this.totalBytes -= entry.bytes;
      this.entries.delete(entry.key);
    }
    this.totalBytes = Math.max(0, this.totalBytes);
  }

  private snapshot(entry: TextureEntry): TextureEntrySnapshot {
    return {
      status: entry.status,
      texture: entry.texture,
      error: entry.error,
    };
  }

  private notify(entry: TextureEntry) {
    const snapshot = this.snapshot(entry);
    for (const listener of entry.listeners) {
      listener(snapshot);
    }
  }

  private emitProgress() {
    this.options.onProgress?.({
      requested: this.requested,
      loaded: this.loaded,
      failed: this.failed,
      active: this.activeLoads,
      queued: this.queue.length,
    });
  }

  private drain() {
    while (
      !this.disposed &&
      this.activeLoads < this.options.concurrency &&
      this.queue.length > 0
    ) {
      const entry = this.queue.shift()!;
      if (entry.refs === 0) {
        entry.status = "idle";
        this.entries.delete(entry.key);
        this.requested = Math.max(0, this.requested - 1);
        continue;
      }
      entry.status = "loading";
      this.activeLoads += 1;
      this.notify(entry);
      this.emitProgress();
      void this.loadAndFinish(entry);
    }
  }

  private async load(entry: TextureEntry, generation: number) {
    let lastError: unknown = null;
    for (let attempt = 0; attempt <= this.options.retryCount; attempt += 1) {
      try {
        const texture = await this.loader.loadAsync(entry.url);
        if (this.disposed || generation !== this.generation) {
          texture.dispose();
          return;
        }
        this.configureTexture(texture);
        entry.texture = texture;
        entry.status = "loaded";
        entry.error = null;
        entry.bytes = entry.address.width * entry.address.height * 4;
        entry.lastUsed = performance.now();
        this.totalBytes += entry.bytes;
        this.loaded += 1;
        this.notify(entry);
        return;
      } catch (error) {
        lastError = error;
      }
    }

    if (!this.disposed && generation === this.generation) {
      entry.status = "error";
      entry.error = lastError;
      this.failed += 1;
      this.notify(entry);
      this.options.onError?.({
        address: entry.address,
        url: entry.url,
        error: lastError,
      });
    }
  }

  private configureTexture(texture: Texture) {
    texture.colorSpace = SRGBColorSpace;
    texture.wrapS = ClampToEdgeWrapping;
    texture.wrapT = ClampToEdgeWrapping;
    texture.magFilter = LinearFilter;
    texture.minFilter = LinearFilter;
    texture.generateMipmaps = false;
    texture.anisotropy = Math.min(4, this.options.anisotropy);
    texture.needsUpdate = true;
  }

  private evict() {
    if (this.totalBytes <= this.options.maxBytes) {
      return;
    }

    const candidates = Array.from(this.entries.values())
      .filter((entry) => entry.refs === 0 && entry.texture)
      .sort((a, b) => a.lastUsed - b.lastUsed);
    for (const entry of candidates) {
      if (this.totalBytes <= this.options.maxBytes) {
        break;
      }
      entry.texture?.dispose();
      this.totalBytes -= entry.bytes;
      this.entries.delete(entry.key);
    }
    this.totalBytes = Math.max(0, this.totalBytes);
  }

  private finishLoad(generation: number) {
    this.activeLoads = Math.max(0, this.activeLoads - 1);
    if (!this.disposed && generation === this.generation) {
      this.emitProgress();
      this.evict();
    }
    if (!this.disposed) {
      this.drain();
    }
  }

  private async loadAndFinish(entry: TextureEntry) {
    const generation = this.generation;
    try {
      await this.load(entry, generation);
    } finally {
      this.finishLoad(generation);
    }
  }
}
