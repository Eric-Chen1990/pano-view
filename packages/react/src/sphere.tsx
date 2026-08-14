import { useThree } from "@react-three/fiber";
import { useEffect, useRef, useState } from "react";
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
import { DEFAULT_PANORAMA_RADIUS } from "./panorama-radius";

export type SphereProps = {
  src: string;
  /** Horizontal image offset in degrees. */
  yawOffset?: number;
  onLoad?: (texture: Texture) => void;
  onError?: (error: unknown) => void;
};

export function Sphere({
  src,
  yawOffset = 0,
  onLoad,
  onError,
}: SphereProps) {
  const gl = useThree((state) => state.gl);
  const [texture, setTexture] = useState<Texture | null>(null);
  const onLoadRef = useRef(onLoad);
  const onErrorRef = useRef(onError);
  onLoadRef.current = onLoad;
  onErrorRef.current = onError;

  useEffect(() => {
    let active = true;
    const loader = new TextureLoader();
    setTexture(null);

    loader.load(
      src,
      (loadedTexture) => {
        if (!active) {
          loadedTexture.dispose();
          return;
        }

        loadedTexture.colorSpace = SRGBColorSpace;
        loadedTexture.wrapS = RepeatWrapping;
        loadedTexture.repeat.x = -1;
        loadedTexture.offset.x = 1;
        loadedTexture.anisotropy = gl.capabilities.getMaxAnisotropy();
        loadedTexture.magFilter = LinearFilter;
        loadedTexture.minFilter = LinearMipmapLinearFilter;
        loadedTexture.generateMipmaps = true;
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

  if (!texture) {
    return null;
  }

  return (
    <mesh rotation={[0, MathUtils.degToRad(90 + yawOffset), 0]}>
      <sphereGeometry args={[DEFAULT_PANORAMA_RADIUS, 128, 64]} />
      <meshBasicMaterial
        map={texture}
        side={BackSide}
        toneMapped={false}
      />
    </mesh>
  );
}
