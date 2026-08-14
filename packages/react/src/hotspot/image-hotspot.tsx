import { useThree } from "@react-three/fiber";
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

export type ImageHotspotProps = HotspotCommonProps & {
  src: string;
  onLoad?: (texture: Texture) => void;
  onError?: (error: unknown) => void;
};

function clampOpacity(opacity: number | undefined): number {
  if (!Number.isFinite(opacity)) {
    return 1;
  }
  return Math.max(0, Math.min(opacity!, 1));
}

function useHotspotImageTexture(
  src: string,
  onLoad: ImageHotspotProps["onLoad"],
  onError: ImageHotspotProps["onError"],
) {
  const gl = useThree((state) => state.gl);
  const [texture, setTexture] = useState<Texture | null>(null);
  const onLoadRef = useRef(onLoad);
  const onErrorRef = useRef(onError);
  onLoadRef.current = onLoad;
  onErrorRef.current = onError;

  useEffect(() => {
    let active = true;
    setTexture(null);
    if (!src) {
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
        setTexture(loadedTexture);
        onLoadRef.current?.(loadedTexture);
      },
      undefined,
      (error) => {
        if (active) {
          onErrorRef.current?.(error);
        }
      },
    );

    return () => {
      active = false;
    };
  }, [gl, src]);

  useEffect(
    () => () => {
      texture?.dispose();
    },
    [texture],
  );

  return texture;
}

export function ImageHotspot({
  src,
  width = 12,
  height = 8,
  opacity,
  onLoad,
  onError,
  ...anchorProps
}: ImageHotspotProps) {
  const texture = useHotspotImageTexture(src, onLoad, onError);

  return (
    <HotspotAnchor {...anchorProps} height={height} width={width}>
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
