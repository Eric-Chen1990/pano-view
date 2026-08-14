import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef, useState } from "react";
import {
  ClampToEdgeWrapping,
  DoubleSide,
  LinearFilter,
  LinearMipmapLinearFilter,
  SRGBColorSpace,
  Texture,
  TextureLoader,
} from "three";
import { HotspotAnchor } from "./hotspot-anchor";
import type { HotspotCommonProps } from "./types";

const DEFAULT_SEQUENCE_FPS = 12;

export type SequenceFrameDirection = "horizontal" | "vertical";

export type SequenceLoadProgress = {
  id: string;
  total: number;
  loaded: number;
  failed: number;
};

export type SequenceFrameEvent = {
  id: string;
  index: number;
  src: string;
};

export type SequencePlaybackState = "playing" | "paused" | "ended";

export type SequenceHotspotErrorEvent = {
  id: string;
  src: string;
  error: unknown;
};

export type SequenceHotspotProps = HotspotCommonProps & {
  /** A sprite sheet containing each frame in equally sized cells. */
  src: string;
  /** Number of cells in the sprite sheet, from left-to-right or top-to-bottom. */
  frameCount: number;
  frameDirection?: SequenceFrameDirection;
  playing: boolean;
  fps?: number;
  loop?: boolean;
  onFrameChange?: (event: SequenceFrameEvent) => void;
  onLoadProgress?: (progress: SequenceLoadProgress) => void;
  onPlaybackStateChange?: (state: SequencePlaybackState) => void;
  onEnded?: () => void;
  onError?: (event: SequenceHotspotErrorEvent) => void;
};

function clampOpacity(opacity: number | undefined): number {
  if (!Number.isFinite(opacity)) {
    return 1;
  }
  return Math.max(0, Math.min(opacity!, 1));
}

function resolveFps(value: number | undefined): number {
  return Number.isFinite(value) && value! > 0 ? value! : DEFAULT_SEQUENCE_FPS;
}

function resolveFrameCount(value: number): number {
  return Number.isFinite(value) ? Math.max(1, Math.floor(value)) : 1;
}

function useSpriteTexture({
  id,
  src,
  onError,
  onLoadProgress,
}: Pick<SequenceHotspotProps, "id" | "src" | "onError" | "onLoadProgress">) {
  const gl = useThree((state) => state.gl);
  const [texture, setTexture] = useState<Texture | null>(null);
  const onErrorRef = useRef(onError);
  const onLoadProgressRef = useRef(onLoadProgress);
  onErrorRef.current = onError;
  onLoadProgressRef.current = onLoadProgress;

  useEffect(() => {
    let active = true;
    setTexture(null);
    if (!src) {
      onLoadProgressRef.current?.({ id, total: 1, loaded: 0, failed: 1 });
      return () => {
        active = false;
      };
    }

    const loader = new TextureLoader();
    loader.load(
      src,
      (loadedTexture) => {
        if (!active) {
          loadedTexture.dispose();
          return;
        }
        loadedTexture.colorSpace = SRGBColorSpace;
        loadedTexture.wrapS = ClampToEdgeWrapping;
        loadedTexture.wrapT = ClampToEdgeWrapping;
        loadedTexture.magFilter = LinearFilter;
        loadedTexture.minFilter = LinearMipmapLinearFilter;
        loadedTexture.generateMipmaps = true;
        loadedTexture.anisotropy = gl.capabilities.getMaxAnisotropy();
        loadedTexture.needsUpdate = true;
        onLoadProgressRef.current?.({ id, total: 1, loaded: 1, failed: 0 });
        setTexture(loadedTexture);
      },
      undefined,
      (error) => {
        if (!active) {
          return;
        }
        onLoadProgressRef.current?.({ id, total: 1, loaded: 0, failed: 1 });
        onErrorRef.current?.({ id, src, error });
      },
    );

    return () => {
      active = false;
    };
  }, [gl, id, src]);

  useEffect(
    () => () => {
      texture?.dispose();
    },
    [texture],
  );

  return texture;
}

export function SequenceHotspot({
  id,
  src,
  frameCount: requestedFrameCount,
  frameDirection = "vertical",
  playing,
  fps,
  loop = true,
  width = 12,
  height = 8,
  opacity,
  onFrameChange,
  onLoadProgress,
  onPlaybackStateChange,
  onEnded,
  onError,
  ...anchorProps
}: SequenceHotspotProps) {
  const texture = useSpriteTexture({ id, src, onError, onLoadProgress });
  const frameCount = resolveFrameCount(requestedFrameCount);
  const safeFps = resolveFps(fps);
  const [frameIndex, setFrameIndex] = useState(0);
  const elapsedRef = useRef(0);
  const frameIndexRef = useRef(0);
  const endedRef = useRef(false);
  const lastPlaybackStateRef = useRef<SequencePlaybackState | null>(null);
  const onFrameChangeRef = useRef(onFrameChange);
  const onPlaybackStateChangeRef = useRef(onPlaybackStateChange);
  const onEndedRef = useRef(onEnded);
  onFrameChangeRef.current = onFrameChange;
  onPlaybackStateChangeRef.current = onPlaybackStateChange;
  onEndedRef.current = onEnded;

  useEffect(() => {
    elapsedRef.current = 0;
    frameIndexRef.current = 0;
    endedRef.current = false;
    setFrameIndex(0);
  }, [frameCount, frameDirection, src]);

  useEffect(() => {
    if (!texture) {
      return;
    }
    texture.repeat.set(
      frameDirection === "horizontal" ? 1 / frameCount : 1,
      frameDirection === "vertical" ? 1 / frameCount : 1,
    );
    texture.offset.set(
      frameDirection === "horizontal" ? frameIndex / frameCount : 0,
      frameDirection === "vertical" ? 1 - (frameIndex + 1) / frameCount : 0,
    );
    texture.needsUpdate = true;
  }, [frameCount, frameDirection, frameIndex, texture]);

  useEffect(() => {
    if (!texture) {
      return;
    }
    onFrameChangeRef.current?.({ id, index: 0, src });
  }, [id, src, texture]);

  useEffect(() => {
    if (!texture) {
      return;
    }
    if (playing && endedRef.current) {
      elapsedRef.current = 0;
      frameIndexRef.current = 0;
      endedRef.current = false;
      setFrameIndex(0);
    }
    if (!playing && endedRef.current) {
      return;
    }
    const nextState: SequencePlaybackState = playing ? "playing" : "paused";
    if (lastPlaybackStateRef.current !== nextState) {
      lastPlaybackStateRef.current = nextState;
      onPlaybackStateChangeRef.current?.(nextState);
    }
  }, [playing, texture]);

  useFrame((_, deltaSeconds) => {
    if (!texture || !playing || endedRef.current) {
      return;
    }
    elapsedRef.current += deltaSeconds;
    const steps = Math.floor(elapsedRef.current * safeFps);
    if (steps === 0) {
      return;
    }
    elapsedRef.current -= steps / safeFps;

    let nextIndex = frameIndexRef.current + steps;
    if (nextIndex >= frameCount) {
      if (loop) {
        nextIndex %= frameCount;
      } else {
        nextIndex = frameCount - 1;
        endedRef.current = true;
        if (lastPlaybackStateRef.current !== "ended") {
          lastPlaybackStateRef.current = "ended";
          onPlaybackStateChangeRef.current?.("ended");
          onEndedRef.current?.();
        }
      }
    }

    if (nextIndex !== frameIndexRef.current) {
      frameIndexRef.current = nextIndex;
      setFrameIndex(nextIndex);
      onFrameChangeRef.current?.({ id, index: nextIndex, src });
    }
  });

  return (
    <HotspotAnchor {...anchorProps} id={id} height={height} width={width}>
      <mesh>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial
          map={texture}
          opacity={texture ? clampOpacity(opacity) : 0}
          side={DoubleSide}
          toneMapped={false}
          transparent
        />
      </mesh>
    </HotspotAnchor>
  );
}
