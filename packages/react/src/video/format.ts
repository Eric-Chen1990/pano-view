import type { PanoVideoTrack, PanoVideoVariant } from "./types";

export const DEFAULT_PANO_VIDEO_PLAYBACK_RATES = [0.5, 1, 1.25, 1.5, 2] as const;

export function clampVolume(volume: number | undefined): number {
  if (!Number.isFinite(volume)) {
    return 1;
  }
  return Math.max(0, Math.min(volume!, 1));
}

export function formatMediaTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return "0:00";
  }
  const total = Math.floor(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const remainder = total % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
  }
  return `${minutes}:${String(remainder).padStart(2, "0")}`;
}

export function panoVideoTrackId(track: PanoVideoTrack): string {
  return track.id ?? track.srcLang;
}

export function resolvePanoVideoVariants({
  poster,
  src,
  variants,
}: {
  poster?: string;
  src?: string;
  variants?: readonly PanoVideoVariant[];
}): PanoVideoVariant[] {
  if (variants && variants.length > 0) {
    return [...variants];
  }
  if (src) {
    return [
      {
        id: "default",
        label: "Default",
        poster,
        sources: [{ src }],
      },
    ];
  }
  return [];
}

export function resolvePanoVideoVariantId(
  variants: readonly PanoVideoVariant[],
  preferredId: string | undefined,
): string {
  if (variants.length === 0) {
    return "default";
  }
  if (preferredId && variants.some((variant) => variant.id === preferredId)) {
    return preferredId;
  }
  return variants[0]!.id;
}

export function defaultPanoVideoTrackId(
  tracks: readonly PanoVideoTrack[],
): string | null {
  const preferred = tracks.find((track) => track.default);
  if (preferred) {
    return panoVideoTrackId(preferred);
  }
  return tracks[0] ? panoVideoTrackId(tracks[0]) : null;
}

export function cueText(cue: TextTrackCue): string {
  if (!("text" in cue) || typeof cue.text !== "string") {
    return "";
  }
  return cue.text.replace(/<[^>]+>/g, "").replace(/\r\n|\r/g, "\n");
}
