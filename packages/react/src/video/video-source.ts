import type Hls from "hls.js";
import type { PanoVideoHlsLevel, PanoVideoHlsQuality, PanoVideoHlsSelection, PanoVideoSource } from "./types";

type HlsModule = typeof import("hls.js/dist/hls.mjs");

export const HLS_MIME = "application/vnd.apple.mpegurl";

export function isHlsSource({ src, type }: PanoVideoSource): boolean {
  return /\.m3u8$/i.test(src.split(/[?#]/, 1)[0]!) ||
    /^(application|audio)\/(vnd\.apple\.mpegurl|x-mpegurl|mpegurl)$/i.test(type?.split(";")[0]?.trim() ?? "");
}

export function nativeHlsLevels(
  parser: HlsModule["M3U8Parser"],
  manifest: string,
  url: string,
): Array<PanoVideoHlsLevel & { url: string }> {
  if (parser.isMediaPlaylist(manifest)) return [];
  const parsed = parser.parseMasterPlaylist(manifest, url);
  if (parsed.playlistParsingError || parsed.contentSteering || parsed.variableList ||
      parsed.hasVariableRefs || parsed.sessionKeys?.length) return [];
  const media = parser.parseMasterPlaylistMedia(manifest, url, parsed);
  return parsed.levels.flatMap(({ attrs, width, height, bitrate, url: levelUrl }, index) => {
    const externalAudio = media.AUDIO?.some((track) => track.groupId === attrs.AUDIO && track.url);
    const externalSubtitles = media.SUBTITLES?.some((track) => track.groupId === attrs.SUBTITLES && track.url);
    return width && height && !externalAudio && !externalSubtitles && !attrs.VIDEO
      ? [{ index, width, height, bitrate, url: levelUrl }]
      : [];
  });
}

export function resetVideoSource(video: HTMLVideoElement): void {
  video.pause();
  video.removeAttribute("src");
  video.querySelectorAll("source").forEach((node) => node.remove());
  video.load();
}

type SourceOptions = {
  crossOrigin: HTMLVideoElement["crossOrigin"] | undefined;
  startImmediately: boolean;
  onError: (error: unknown) => void;
  onChange: () => void;
  /** True once the original source has rendered its first frame. */
  hasLoaded: () => boolean;
};

export function loadVideoSources(
  video: HTMLVideoElement,
  sources: readonly PanoVideoSource[],
  options: SourceOptions,
) {
  const request = new AbortController();
  let cleanup = () => {};
  let hls: Hls | undefined;
  let hlsStarted = false;
  let manifestParsed = false;
  let shouldStart = options.startImmediately;
  let nativeUrl: string | undefined;
  let nativeLevels: ReturnType<typeof nativeHlsLevels> = [];
  let qualityLevels: readonly PanoVideoHlsLevel[] = [];
  let nativeSelection: PanoVideoHlsSelection = "auto";
  let hlsAudio: boolean | undefined;

  const start = () => {
    shouldStart = true;
    if (hls && manifestParsed && !hlsStarted) {
      hlsStarted = true;
      hls.startLoad();
    }
  };

  const load = async (offset: number) => {
    if (request.signal.aborted) return;
    cleanup();
    cleanup = () => {};
    const source = sources[offset];
    if (!source) return;
    const fail = (error: unknown, next: number) => {
      if (request.signal.aborted) return;
      if (!options.hasLoaded() && next < sources.length) {
        void load(next);
      } else {
        options.onError(error);
      }
    };

    if (!isHlsSource(source)) {
      video.crossOrigin = options.crossOrigin ?? null;
      let end = offset;
      const elements: HTMLSourceElement[] = [];
      while (end < sources.length && !isHlsSource(sources[end]!)) {
        const item = sources[end++]!;
        const element = video.ownerDocument.createElement("source");
        element.src = item.src;
        if (item.type) element.type = item.type;
        video.appendChild(element);
        elements.push(element);
      }
      const last = elements[elements.length - 1]!;
      const onError = () => fail(
        video.error ?? new DOMException("Unable to load panorama video.", "NotSupportedError"),
        end,
      );
      // Native source selection handles all the file formats in this group.
      last.addEventListener("error", onError);
      video.addEventListener("error", onError);
      cleanup = () => {
        last.removeEventListener("error", onError);
        video.removeEventListener("error", onError);
        elements.forEach((element) => element.remove());
      };
      video.load();
      return;
    }

    let module: HlsModule | undefined;
    try {
      // The ESM build exposes the manifest parser along with Hls.
      module = await import("hls.js/dist/hls.mjs");
    } catch {
      // Native playback can still work if the HLS chunk cannot be loaded.
    }
    if (request.signal.aborted) return;
    const Hls = module?.default;
    const canPlayNative = Boolean(video.canPlayType(HLS_MIME) || video.canPlayType("application/x-mpegURL"));

    const loadNative = () => {
      video.crossOrigin = options.crossOrigin ?? "anonymous";
      nativeUrl = source.src;
      const onError = () => fail(video.error ?? new Error("Unable to load native HLS."), offset + 1);
      video.addEventListener("error", onError);
      let current = true;
      cleanup = () => {
        current = false;
        nativeUrl = undefined;
        nativeLevels = [];
        qualityLevels = [];
        video.removeEventListener("error", onError);
        video.removeAttribute("src");
      };
      video.src = source.src;
      video.load();
      options.onChange();
      const parser = module?.M3U8Parser;
      if (parser) {
        void fetch(source.src, {
          signal: request.signal,
          credentials: options.crossOrigin === "use-credentials" ? "include" : "same-origin",
        }).then(async (response) => {
          if (!response.ok) return;
          const levels = nativeHlsLevels(parser, await response.text(), response.url);
          if (current && !request.signal.aborted) {
            nativeLevels = levels;
            qualityLevels = levels.map(({ index, width, height, bitrate }) => ({ index, width, height, bitrate }));
            options.onChange();
          }
        }).catch(() => {
          // Native automatic playback does not depend on JS fetching the manifest.
        });
      }
    };

    if (!Hls?.isSupported()) {
      if (canPlayNative) loadNative();
      else fail(new DOMException("HLS playback is unavailable in this browser.", "NotSupportedError"), offset + 1);
      return;
    }

    const instance = new Hls({
      autoStartLoad: false,
      ...(options.crossOrigin === "use-credentials" && {
        xhrSetup: (xhr: XMLHttpRequest) => { xhr.withCredentials = true; },
      }),
    });
    hls = instance;
    const onUpdate = options.onChange;
    const updateLevels = () => {
      qualityLevels = instance.levels.map(({ width, height, bitrate }, index) => ({ index, width, height, bitrate }));
      onUpdate();
    };
    instance.on(Hls.Events.MANIFEST_PARSED, () => {
      manifestParsed = true;
      if (shouldStart) start();
      updateLevels();
    });
    instance.on(Hls.Events.LEVEL_SWITCHED, onUpdate);
    instance.on(Hls.Events.LEVELS_UPDATED, updateLevels);
    instance.on(Hls.Events.AUDIO_TRACKS_UPDATED, onUpdate);
    instance.on(Hls.Events.BUFFER_CREATED, (_, { tracks }) => {
      if (tracks.audio || tracks.audiovideo) hlsAudio = true;
      else if (tracks.video && !instance.audioTracks.some((track) => track.url)) hlsAudio = false;
      onUpdate();
    });
    instance.on(Hls.Events.ERROR, (_, error) => {
      if (error.fatal) {
        if (!options.hasLoaded() && canPlayNative) {
          cleanup();
          loadNative();
        } else {
          fail(error, offset + 1);
        }
      } else {
        onUpdate();
      }
    });
    cleanup = () => {
      hls = undefined;
      hlsAudio = undefined;
      qualityLevels = [];
      hlsStarted = false;
      manifestParsed = false;
      instance.destroy();
    };
    video.crossOrigin = options.crossOrigin ?? null;
    instance.loadSource(source.src);
    instance.attachMedia(video);
    onUpdate();
  };

  void load(0);
  return {
    start,
    get native() { return nativeUrl !== undefined; },
    get audio(): boolean | undefined {
      return hls?.audioTracks.some((track) => track.url) ? true : hlsAudio;
    },
    quality(activeVideo: HTMLVideoElement): PanoVideoHlsQuality | undefined {
      if (!hls && !nativeUrl) return undefined;
      const { videoWidth: width, videoHeight: height } = activeVideo;
      const matching = qualityLevels.find((level) => level.width === width && level.height === height);
      const ambiguous = matching && qualityLevels.some((level) => level !== matching && level.width === width && level.height === height);
      return {
        levels: qualityLevels,
        selectedLevel: hls ? (hls.autoLevelEnabled ? "auto" : hls.manualLevel) : nativeSelection,
        activeLevel: hls ? (hls.currentLevel < 0 ? null : hls.currentLevel)
          : typeof nativeSelection === "number" ? nativeSelection
          : !ambiguous ? matching?.index ?? null : null,
        resolution: width && height ? { width, height } : undefined,
      };
    },
    nativeTarget(level: PanoVideoHlsSelection): string | undefined {
      return level === "auto" ? nativeUrl : nativeLevels.find(({ index }) => index === level)?.url;
    },
    selectLevel(level: PanoVideoHlsSelection) {
      if (hls && (level === "auto" || (Number.isInteger(level) && hls.levels[level]))) {
        hls.nextLevel = level === "auto" ? -1 : level;
        options.onChange();
      } else if (nativeUrl) {
        nativeSelection = level;
      }
    },
    dispose() {
      if (request.signal.aborted) return;
      request.abort();
      cleanup();
    },
  };
}
