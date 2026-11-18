import { useFrame } from "@react-three/fiber";
import { useEffect, useState, type RefObject } from "react";

const MOTION_FRAME_LIMIT = 240;

export type VideoMotionStats = {
  lastViewChange: number;
  frames: number[];
  nextFrame: number;
};

export function VideoMotionSampler({ stats }: { stats: VideoMotionStats }) {
  useFrame((_, delta) => {
    if (performance.now() - stats.lastViewChange > 200 || document.hidden) return;
    stats.frames[stats.nextFrame] = delta * 1_000;
    stats.nextFrame = (stats.nextFrame + 1) % MOTION_FRAME_LIMIT;
  });
  return null;
}

type Metrics = {
  firstFrame?: number;
  resolution?: string;
  stalls: number;
  stallMs: number;
  dropRate?: number;
  motionP95?: number;
};

const EMPTY_METRICS: Metrics = { stalls: 0, stallMs: 0 };

export function VideoPerformanceMetrics({
  root,
  motion,
}: {
  root: RefObject<HTMLDivElement | null>;
  motion: VideoMotionStats;
}) {
  const [metrics, setMetrics] = useState(EMPTY_METRICS);

  useEffect(() => {
    const container = root.current;
    if (!container) return;
    let active: HTMLVideoElement | null = null;
    let detach: (() => void) | undefined;
    let sample: (() => void) | undefined;
    const frameTiming = new WeakMap<HTMLVideoElement, { start: number; firstFrame?: number }>();
    const onMediaTiming = (event: Event) => {
      const video = event.target;
      if (!(video instanceof HTMLVideoElement) || !video.hasAttribute("data-pano-texture-video")) return;
      if (event.type === "loadstart") {
        frameTiming.set(video, { start: performance.now() });
      } else {
        const timing = frameTiming.get(video);
        if (timing && timing.firstFrame === undefined) timing.firstFrame = performance.now() - timing.start;
      }
    };
    container.addEventListener("loadstart", onMediaTiming, true);
    container.addEventListener("loadeddata", onMediaTiming, true);

    const bindVideo = () => {
      // The active video is mounted first. During a native HLS handoff the
      // candidate is appended and becomes active when the old video is removed.
      const video = container.querySelector<HTMLVideoElement>("video[data-pano-texture-video]");
      if (video === active) return;
      detach?.();
      active = video;
      motion.frames.length = 0;
      motion.nextFrame = 0;
      if (!video) {
        detach = undefined;
        sample = undefined;
        setMetrics(EMPTY_METRICS);
        return;
      }

      let waitingSince: number | undefined;
      let stalls = 0;
      let stallMs = 0;
      let baseline: VideoPlaybackQuality | undefined = video.getVideoPlaybackQuality?.();
      const reset = () => {
        waitingSince = undefined;
        stalls = 0;
        stallMs = 0;
        baseline = undefined;
        motion.frames.length = 0;
        motion.nextFrame = 0;
      };
      const onWaiting = () => {
        const timing = frameTiming.get(video);
        if (video.readyState >= video.HAVE_METADATA && !video.paused && !video.seeking &&
            (!timing || timing.firstFrame !== undefined) && waitingSince === undefined) {
          stalls += 1;
          waitingSince = performance.now();
        }
      };
      const endWaiting = () => {
        if (waitingSince !== undefined) stallMs += performance.now() - waitingSince;
        waitingSince = undefined;
      };
      const listeners = {
        loadstart: reset,
        waiting: onWaiting,
        playing: endWaiting,
        pause: endWaiting,
        seeking: endWaiting,
        ended: endWaiting,
        error: endWaiting,
      };
      for (const [event, listener] of Object.entries(listeners)) video.addEventListener(event, listener);
      detach = () => {
        for (const [event, listener] of Object.entries(listeners)) video.removeEventListener(event, listener);
      };
      sample = () => {
        const frameCounts = video.getVideoPlaybackQuality?.();
        const total = (frameCounts?.totalVideoFrames ?? 0) - (baseline?.totalVideoFrames ?? 0);
        const dropped = (frameCounts?.droppedVideoFrames ?? 0) - (baseline?.droppedVideoFrames ?? 0);
        const frames = [...motion.frames].sort((a, b) => a - b);
        setMetrics({
          firstFrame: frameTiming.get(video)?.firstFrame,
          resolution: video.videoWidth ? `${video.videoWidth} × ${video.videoHeight}` : undefined,
          stalls,
          stallMs: stallMs + (waitingSince === undefined ? 0 : performance.now() - waitingSince),
          dropRate: total > 0 && dropped >= 0 ? dropped / total : undefined,
          motionP95: frames[Math.ceil(frames.length * 0.95) - 1],
        });
      };
      sample();
    };

    const observer = new MutationObserver(bindVideo);
    observer.observe(container, { childList: true, subtree: true });
    bindVideo();
    const timer = window.setInterval(() => {
      if (!document.hidden) sample?.();
    }, 1_000);
    return () => {
      window.clearInterval(timer);
      observer.disconnect();
      container.removeEventListener("loadstart", onMediaTiming, true);
      container.removeEventListener("loadeddata", onMediaTiming, true);
      detach?.();
    };
  }, [motion, root]);

  const time = (ms?: number) => ms === undefined ? "—" : `${Math.round(ms)} ms`;
  const readings = [
    ["Decoded resolution", metrics.resolution ?? "—"],
    ["First decoded frame", time(metrics.firstFrame)],
    ["Buffer waits", `${metrics.stalls} / ${(metrics.stallMs / 1_000).toFixed(1)} s`],
    ["Video frames dropped", metrics.dropRate === undefined ? "—" : `${(metrics.dropRate * 100).toFixed(1)}%`],
    ["Moving frame p95", time(metrics.motionP95)],
  ];
  return (
    <dl className="flex flex-wrap gap-x-6 gap-y-2 border-t border-line px-5 py-3 text-xs">
      {readings.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd className="font-mono font-semibold tabular-nums">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
