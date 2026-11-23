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

export type PanoVideoControlButton =
  | "play"
  | "volume"
  | "playbackRate"
  | "quality"
  | "captions"
  | "vr"
  | "fullscreen";

export type PanoVideoControlsOptions = PanoVideoControlsAppearance & {
  /** Set a button to false to hide it. Omitted buttons follow media and viewer capabilities. */
  buttons?: Partial<Record<PanoVideoControlButton, boolean>>;
};

export type PanoVideoErrorSource = "poster" | "video" | "track";

export type PanoVideoErrorEvent = {
  source: PanoVideoErrorSource;
  error: unknown;
};

export type PanoVideoHlsLevel = {
  index: number;
  width: number;
  height: number;
  bitrate: number;
};

export type PanoVideoHlsSelection = number | "auto";

export type PanoVideoHlsQuality = {
  levels: readonly PanoVideoHlsLevel[];
  selectedLevel: PanoVideoHlsSelection;
  activeLevel: number | null;
  resolution?: { width: number; height: number };
};

export type PanoVideoQualitySwitch = {
  target: { level: PanoVideoHlsSelection } | { variantId: string };
  state: "buffering" | "awaiting-gesture";
};

export type PanoVideoPlaybackSnapshot = {
  ready: boolean;
  playing: boolean;
  blocked: boolean;
  ended: boolean;
  currentTime: number;
  duration: number;
  /** Undefined when audio track presence is unknown. */
  hasAudio?: boolean;
  volume: number;
  /** False when the element ignores `volume` (iOS Safari). Mute still works. */
  volumeAdjustable: boolean;
  muted: boolean;
  playbackRate: number;
  variantId: string;
  variants: readonly PanoVideoVariant[];
  hlsQuality?: PanoVideoHlsQuality;
  qualitySwitch?: PanoVideoQualitySwitch;
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
  setHlsLevel?: (level: PanoVideoHlsSelection) => void;
  setTrackId: (id: string | null) => void;
  setCaptionAppearance: (
    appearance: Partial<PanoVideoCaptionAppearance>,
  ) => void;
};
