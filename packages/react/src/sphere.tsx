import { useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  BackSide,
  LinearFilter,
  LinearMipmapLinearFilter,
  MathUtils,
  RepeatWrapping,
  SRGBColorSpace,
  Texture,
  TextureLoader,
} from "three";
import { resolveUrlAgainstFile } from "./asset-url";
import { PanoBasicMaterial } from "./pano-filter/pano-basic-material";
import { DEFAULT_PANORAMA_RADIUS } from "./panorama-radius";

export type SphereProps = {
  src: string;
  /**
   * Low-resolution 2:1 equirectangular image shown while `src` loads.
   * Relative paths resolve against the directory of `src`. Root-absolute and
   * `http(s)` / `blob:` / `data:` URLs are used as-is. For krpano sphere
   * scenes, copy `<preview url>`.
   */
  previewUrl: string;
  /** Horizontal image offset in degrees. */
  yawOffset?: number;
  /** Called once the first paintable texture (preview or `src`) is ready. */
  onReady?: () => void;
  onLoad?: (texture: Texture) => void;
  onError?: (error: unknown) => void;
  /** Called when `previewUrl` cannot be loaded; `src` still continues. */
  onPreviewError?: (error: unknown) => void;
  /** Keeps the source mounted for preloading without drawing it. */
  visible?: boolean;
};

function useEquirectTexture(
  url: string | null,
  anisotropy: number,
  generateMipmaps: boolean,
  onLoad?: (texture: Texture) => void,
  onError?: (error: unknown) => void,
) {
  const [texture, setTexture] = useState<Texture | null>(null);
  const onLoadRef = useRef(onLoad);
  const onErrorRef = useRef(onError);
  onLoadRef.current = onLoad;
  onErrorRef.current = onError;

  useEffect(() => {
    if (!url) {
      setTexture(null);
      return;
    }

    let active = true;
    const loader = new TextureLoader();
    setTexture(null);

    loader.load(
      url,
      (loadedTexture) => {
        if (!active) {
          loadedTexture.dispose();
          return;
        }

        loadedTexture.colorSpace = SRGBColorSpace;
        loadedTexture.wrapS = RepeatWrapping;
        loadedTexture.repeat.x = -1;
        loadedTexture.offset.x = 1;
        loadedTexture.anisotropy = anisotropy;
        loadedTexture.magFilter = LinearFilter;
        loadedTexture.minFilter = generateMipmaps
          ? LinearMipmapLinearFilter
          : LinearFilter;
        loadedTexture.generateMipmaps = generateMipmaps;
        loadedTexture.needsUpdate = true;
        setTexture(loadedTexture);
        onLoadRef.current?.(loadedTexture);
      },
      undefined,
      (error) => {
        if (active) {
          setTexture(null);
          onErrorRef.current?.(error);
        }
      },
    );

    return () => {
      active = false;
    };
  }, [anisotropy, generateMipmaps, url]);

  useEffect(
    () => () => {
      texture?.dispose();
    },
    [texture],
  );

  return texture;
}

export function Sphere({
  src,
  previewUrl,
  yawOffset = 0,
  onReady,
  onLoad,
  onError,
  onPreviewError,
  visible = true,
}: SphereProps) {
  const gl = useThree((state) => state.gl);
  const anisotropy = gl.capabilities.getMaxAnisotropy();
  const resolvedPreviewUrl = useMemo(
    () => resolveUrlAgainstFile(src, previewUrl),
    [previewUrl, src],
  );
  const texture = useEquirectTexture(
    src,
    anisotropy,
    true,
    onLoad,
    onError,
  );
  const previewTexture = useEquirectTexture(
    texture ? null : resolvedPreviewUrl,
    anisotropy,
    false,
    undefined,
    onPreviewError,
  );
  const displayTexture = texture ?? previewTexture;
  const readyRef = useRef(false);

  useEffect(() => {
    readyRef.current = false;
  }, [resolvedPreviewUrl, src]);

  useEffect(() => {
    if (!displayTexture || readyRef.current) {
      return;
    }
    readyRef.current = true;
    onReady?.();
  }, [displayTexture, onReady]);

  if (!displayTexture) {
    return null;
  }

  return (
    <mesh
      rotation={[0, MathUtils.degToRad(90 + yawOffset), 0]}
      visible={visible}
    >
      <sphereGeometry args={[DEFAULT_PANORAMA_RADIUS, 128, 64]} />
      <PanoBasicMaterial
        map={displayTexture}
        side={BackSide}
        toneMapped={false}
      />
    </mesh>
  );
}
