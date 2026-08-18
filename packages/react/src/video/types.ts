import type { CSSProperties } from "react";
import type { VideoPlaybackState } from "../hotspot/video-hotspot";

export type PanoVideoSource = {
  src: string;
  type?: string;
};

export type PanoVideoVariant = {
  id: string;
  label: string;
  poster?: string;
  sources: readonly PanoVideoSource[];
};

export type PanoVideoTrackKind = "subtitles" | "captions";

export type PanoVideoTrack = {
  /** Defaults to `srcLang`. */
  id?: string;
  src: string;
  srcLang: string;
  label: string;
  kind?: PanoVideoTrackKind;
  default?: boolean;
};

export type PanoVideoCaptionAppearance = {
  color?: string;
  background?: string;
  fontSize?: number | string;
  fontFamily?: string;
  fontWeight?: CSSProperties["fontWeight"];
  textShadow?: string;
  padding?: string;
  borderRadius?: number | string;
  maxWidth?: number | string;
  bottom?: number | string;
  lineHeight?: number | string;
};

export type PanoVideoControlsAppearance = {
  background?: string;
  color?: string;
  accent?: string;
  borderRadius?: number | string;
  fontSize?: number | string;
  padding?: string;
};

export type PanoVideoErrorSource = "poster" | "video" | "track";

export type PanoVideoErrorEvent = {
  source: PanoVideoErrorSource;
  error: unknown;
};

export type PanoVideoPlaybackSnapshot = {
  ready: boolean;
  playing: boolean;
  blocked: boolean;
  ended: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  /** False when the element ignores `volume` (iOS Safari). Mute still works. */
  volumeAdjustable: boolean;
  muted: boolean;
  playbackRate: number;
  variantId: string;
  variants: readonly PanoVideoVariant[];
  trackId: string | null;
  tracks: readonly PanoVideoTrack[];
  captionText: string;
  captionAppearance: Required<PanoVideoCaptionAppearance>;
  captionsEnabled: boolean;
  playbackRates: readonly number[];
  playbackState: VideoPlaybackState;
};

export type PanoVideoController = {
  subscribe: (onStoreChange: () => void) => () => void;
  getSnapshot: () => PanoVideoPlaybackSnapshot;
  play: () => Promise<void>;
  pause: () => void;
  togglePlay: () => void;
  seek: (time: number) => void;
  setVolume: (volume: number) => void;
  setMuted: (muted: boolean) => void;
  toggleMuted: () => void;
  setPlaybackRate: (rate: number) => void;
  setVariantId: (id: string) => void;
  setTrackId: (id: string | null) => void;
  setCaptionAppearance: (
    appearance: Partial<PanoVideoCaptionAppearance>,
  ) => void;
};
