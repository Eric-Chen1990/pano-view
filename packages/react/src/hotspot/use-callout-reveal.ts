import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  resolveCalloutAnimation,
  stepCalloutReveal,
  type CalloutAnimation,
  type CalloutRevealProgress,
} from "./callout-layout";

function subscribeReducedMotion(onStoreChange: () => void) {
  if (typeof window === "undefined" || !window.matchMedia) {
    return () => undefined;
  }
  const media = window.matchMedia("(prefers-reduced-motion: reduce)");
  media.addEventListener("change", onStoreChange);
  return () => media.removeEventListener("change", onStoreChange);
}

function reducedMotionSnapshot() {
  if (typeof window === "undefined" || !window.matchMedia) {
    return false;
  }
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Two-phase callout reveal driven from the render loop.
 * Progress lives in a ref for imperative DOM/mesh updates; `mounted` is
 * React state so the overlay can unmount after close finishes.
 */
export function useCalloutReveal(
  open: boolean,
  animation: CalloutAnimation | undefined,
): {
  progress: { current: CalloutRevealProgress };
  mounted: boolean;
  reducedMotion: boolean;
} {
  const reducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    reducedMotionSnapshot,
    () => false,
  );
  const { lineDuration, contentDuration } = resolveCalloutAnimation(animation);
  const invalidate = useThree((state) => state.invalidate);
  const progress = useRef<CalloutRevealProgress>({
    lineProgress: open ? 1 : 0,
    contentProgress: open ? 1 : 0,
  });
  const [mounted, setMounted] = useState(open);
  const openRef = useRef(open);
  openRef.current = open;

  useEffect(() => {
    if (open) {
      setMounted(true);
      if (reducedMotion || (lineDuration <= 0 && contentDuration <= 0)) {
        progress.current = { lineProgress: 1, contentProgress: 1 };
      }
      invalidate();
      return;
    }
    if (reducedMotion || (lineDuration <= 0 && contentDuration <= 0)) {
      progress.current = { lineProgress: 0, contentProgress: 0 };
      setMounted(false);
    }
    invalidate();
  }, [contentDuration, invalidate, lineDuration, open, reducedMotion]);

  useFrame((_, delta) => {
    const next = stepCalloutReveal(
      openRef.current,
      progress.current,
      delta * 1000,
      lineDuration,
      contentDuration,
      reducedMotion,
    );
    progress.current = {
      lineProgress: next.lineProgress,
      contentProgress: next.contentProgress,
    };
    const animating =
      openRef.current
        ? next.lineProgress < 1 || next.contentProgress < 1
        : next.mounted;
    if (animating) {
      invalidate();
    }
    if (next.mounted !== mounted) {
      setMounted(next.mounted);
    }
  });

  return { progress, mounted, reducedMotion };
}
