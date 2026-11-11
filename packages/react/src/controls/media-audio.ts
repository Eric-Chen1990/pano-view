type AudioTrackList = EventTarget & { readonly length: number };
type AudioMetadata = HTMLMediaElement & {
  readonly audioTracks?: AudioTrackList;
  readonly mozHasAudio?: boolean;
  readonly webkitAudioDecodedByteCount?: number;
};

/** Undefined means the browser has not exposed enough information yet. */
export function probeMediaHasAudio(media: HTMLMediaElement): boolean | undefined {
  if (media.readyState < 1) return undefined;
  const metadata = media as AudioMetadata;
  if ((metadata.audioTracks?.length ?? 0) > 0 || metadata.mozHasAudio === true ||
    (metadata.webkitAudioDecodedByteCount ?? 0) > 0) return true;
  if (metadata.audioTracks?.length === 0 || metadata.mozHasAudio === false) return false;
  return undefined;
}

/** Track lists can be replaced when an element loads a different source. */
export function subscribeMediaAudio(media: HTMLMediaElement, notify: () => void): () => void {
  let tracks: AudioTrackList | undefined;
  const trackEvents = ["addtrack", "removetrack", "change"];
  const sync = () => {
    const next = (media as AudioMetadata).audioTracks;
    if (next !== tracks) {
      trackEvents.forEach((event) => tracks?.removeEventListener(event, notify));
      tracks = next;
      trackEvents.forEach((event) => tracks?.addEventListener(event, notify));
    }
    notify();
  };
  const events = ["loadstart", "emptied", "loadedmetadata", "loadeddata", "playing", "timeupdate"];
  events.forEach((event) => media.addEventListener(event, sync));
  sync();
  return () => {
    events.forEach((event) => media.removeEventListener(event, sync));
    trackEvents.forEach((event) => tracks?.removeEventListener(event, notify));
  };
}
