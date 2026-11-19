import { getTextureAnisotropy, fitImageTexture } from "../renderer-capabilities";
import { useThree } from "@react-three/fiber";
import { useEffect, useRef, useState } from "react";
import {
  ClampToEdgeWrapping,
  LinearFilter,
  LinearMipmapLinearFilter,
  SRGBColorSpace,
  Texture,
  TextureLoader,
} from "three";
import { HotspotMediaPlane } from "./hotspot-media-plane";
import type { HotspotCommonProps, HotspotCornerProps } from "./types";

export type ImageHotspotProps = HotspotCommonProps & HotspotCornerProps & {
  src: string;
  onLoad?: (texture: Texture) => void;
  onError?: (error: unknown) => void;
};

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
        fitImageTexture(gl, loadedTexture);
        loadedTexture.colorSpace = SRGBColorSpace;
        loadedTexture.wrapS = ClampToEdgeWrapping;
        loadedTexture.wrapT = ClampToEdgeWrapping;
        loadedTexture.magFilter = LinearFilter;
        loadedTexture.minFilter = LinearMipmapLinearFilter;
        loadedTexture.generateMipmaps = true;
        loadedTexture.anisotropy = getTextureAnisotropy(gl);
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
    <HotspotMediaPlane {...anchorProps} height={height} width={width} map={texture} opacity={opacity} />
  );
}
