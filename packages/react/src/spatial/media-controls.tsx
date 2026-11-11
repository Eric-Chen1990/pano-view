import { useContext, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { AutomaticControlContext, explicitTargets, PanoMediaControls, subscribeExplicitTargets } from "../controls/components";
import { allowsAutomaticMediaControls } from "../controls/layout";
import { mediaControllers, usePanoMediaController } from "../controls/media";
import type { PanoMediaController } from "../controls/actions";
import { SpatialHostContext, type SpatialSurface } from "./host";

export const spatialVideoPlaybackBlocked = new WeakSet<HTMLVideoElement>();

type Entry = {
  key: string;
  video: HTMLVideoElement;
  slot: HTMLDivElement;
  controller: PanoMediaController | null;
};

function VideoControls({ video, controller }: { video: HTMLVideoElement; controller: PanoMediaController }) {
  const guarded = useMemo<PanoMediaController>(() => ({
    ...controller,
    play: async () => {
      try {
        await controller.play();
        spatialVideoPlaybackBlocked.delete(video);
      } catch (error) {
        spatialVideoPlaybackBlocked.add(video);
        throw error;
      }
    },
  }), [controller, video]);
  useLayoutEffect(() => () => { spatialVideoPlaybackBlocked.delete(video); }, [video]);
  return <PanoMediaControls controller={guarded} aria-label="Video controls" />;
}

function UnregisteredVideoControls({ video }: { video: HTMLVideoElement }) {
  const ref = useRef<HTMLMediaElement | null>(video);
  const controller = usePanoMediaController(ref);
  return <VideoControls video={video} controller={controller} />;
}

/** Slots participate in the original layout; the video is never cloned or reparented. */
function SurfaceMediaControls({ surface }: { surface: SpatialSurface }) {
  const host = useContext(SpatialHostContext)!;
  const [entries, setEntries] = useState<Entry[]>([]);
  useLayoutEffect(() => {
    const slots = new Map<HTMLVideoElement, Entry>();
    let nextKey = 0;
    setEntries([]);
    const sync = () => {
      const videos = [...surface.element.querySelectorAll("video")];
      const automatic = videos.filter((video) => {
        if (!allowsAutomaticMediaControls(video) || explicitTargets.has(mediaControllers.get(video) ?? video)) return false;
        return ![...host.controls].some(([node]) => node === video || node.contains(video));
      });
      let changed = false;
      for (const [video, entry] of slots) {
        if (!automatic.includes(video)) {
          entry.slot.remove();
          slots.delete(video);
          changed = true;
        }
      }
      for (const video of automatic) {
        let entry = slots.get(video);
        if (!entry) {
          const slot = video.ownerDocument.createElement("div");
          slot.dataset.panoAutoMediaSlot = "";
          Object.assign(slot.style, { display: "block", width: "100%", flex: "none", minWidth: "0", marginTop: "12px", marginBottom: "12px", pointerEvents: "auto" });
          entry = { key: String(nextKey++), video, slot, controller: mediaControllers.get(video) ?? null };
          slots.set(video, entry);
          changed = true;
        }
        if (video.nextSibling !== entry.slot) video.after(entry.slot);
        // Video-local tokens must also reach the following sibling control group.
        const style = getComputedStyle(video);
        for (const name of ["background", "color", "border", "radius", "size", "gap", "padding", "focus"]) {
          const property = `--pano-control-${name}`;
          const value = style.getPropertyValue(property).trim();
          if (entry.slot.style.getPropertyValue(property).trim() !== value) {
            if (value) entry.slot.style.setProperty(property, value);
            else entry.slot.style.removeProperty(property);
          }
        }
      }
      if (changed) setEntries([...slots.values()]);
    };
    const observer = new MutationObserver(sync);
    observer.observe(surface.element, { childList: true, subtree: true, attributes: true, attributeFilter: ["style", "class"] });
    const unsubscribe = host.subscribe(sync);
    const unsubscribeTargets = subscribeExplicitTargets(sync);
    sync();
    return () => {
      observer.disconnect();
      unsubscribe();
      unsubscribeTargets();
      slots.forEach(({ slot }) => slot.remove());
    };
  }, [host, surface]);
  return <AutomaticControlContext.Provider value={true}>
    {entries.map(({ key, video, slot, controller }) => createPortal(
      controller ? <VideoControls video={video} controller={controller} /> : <UnregisteredVideoControls video={video} />,
      slot,
      key
    ))}
  </AutomaticControlContext.Provider>;
}

/** Runs in the viewer's DOM renderer, alongside the fullscreen-local portal host. */
export function SpatialMediaControls() {
  const host = useContext(SpatialHostContext)!;
  useSyncExternalStore(host.subscribe, host.getSnapshot, () => 0);
  const surfaces = [...host.surfaces];
  const surface = surfaces[surfaces.length - 1];
  return host.mode && surface ? <SurfaceMediaControls surface={surface} /> : null;
}
