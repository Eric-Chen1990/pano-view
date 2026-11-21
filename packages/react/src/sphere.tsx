import { getTextureAnisotropy, fitImageTexture } from "./renderer-capabilities";
import { useThree, type RootState } from "@react-three/fiber";
import { useContext, useEffect, useMemo, useRef, useState } from "react";
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
import { useSceneDetailReporter } from "./scene-detail";
import { SceneLoadSourceContext, useStandaloneSceneLoad } from "./scene-load-progress";
import { usePreviewTexture } from "./preview-texture";
import { CompareSourceSideContext } from "./compare/view";

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

function configureEquirectTexture(
  texture: Texture,
  gl: RootState["gl"],
  generateMipmaps: boolean,
) {
  texture.colorSpace = SRGBColorSpace;
  texture.wrapS = RepeatWrapping;
  texture.repeat.x = -1;
  texture.offset.x = 1;
  texture.anisotropy = getTextureAnisotropy(gl);
  texture.magFilter = LinearFilter;
  texture.minFilter = generateMipmaps ? LinearMipmapLinearFilter : LinearFilter;
  texture.generateMipmaps = generateMipmaps;
  texture.needsUpdate = true;
}

function configureSpherePreview(texture: Texture, gl: RootState["gl"]) {
  configureEquirectTexture(texture, gl, false);
}

function SphereSurface({ texture, yawOffset, visible = true }: {
  texture: Texture; yawOffset: number; visible?: boolean;
}) {
  return (
    <mesh rotation={[0, MathUtils.degToRad(90 + yawOffset), 0]} visible={visible}>
      <sphereGeometry args={[DEFAULT_PANORAMA_RADIUS, 128, 64]} />
      <PanoBasicMaterial map={texture} side={BackSide} toneMapped={false} />
    </mesh>
  );
}

function useEquirectTexture(
  url: string,
  gl: RootState["gl"],
  onLoad?: (texture: Texture) => void,
  onError?: (error: unknown) => void,
) {
  const [loaded, setLoaded] = useState<{ url: string; gl: RootState["gl"]; texture: Texture }>();
  const [failed, setFailed] = useState<{ url: string; gl: RootState["gl"]; error: unknown }>();
  const onLoadRef = useRef(onLoad);
  const onErrorRef = useRef(onError);
  onLoadRef.current = onLoad;
  onErrorRef.current = onError;

  useEffect(() => {
    if (!url) return;

    let active = true;
    const loader = new TextureLoader();
    setLoaded(undefined);
    setFailed(undefined);

    loader.load(
      url,
      (loadedTexture) => {
        if (!active) {
          loadedTexture.dispose();
          return;
        }

        fitImageTexture(gl, loadedTexture);
        configureEquirectTexture(loadedTexture, gl, true);
        setLoaded({ url, gl, texture: loadedTexture });
        onLoadRef.current?.(loadedTexture);
      },
      undefined,
      (error) => {
        if (active) {
          setFailed({ url, gl, error });
          onErrorRef.current?.(error);
        }
      },
    );

    return () => {
      active = false;
    };
  }, [gl, url]);

  useEffect(
    () => () => {
      loaded?.texture.dispose();
    },
    [loaded],
  );

  return {
    texture: loaded?.url === url && loaded.gl === gl ? loaded.texture : null,
    failure: failed?.url === url && failed.gl === gl ? failed : undefined,
  };
}

export function SphereSource({
  src,
  previewUrl,
  yawOffset = 0,
  onReady,
  onLoad,
  onError,
  onPreviewError,
  visible = true,
  previewOnly = false,
}: SphereProps & { previewOnly?: boolean }) {
  const gl = useThree((state) => state.gl);
  const compareSide = useContext(CompareSourceSideContext);
  const resolvedPreviewUrl = useMemo(
    () => previewUrl ? resolveUrlAgainstFile(src, previewUrl) : "",
    [previewUrl, src],
  );
  const loadKey = useMemo(() => ({ src, resolvedPreviewUrl, gl }), [src, resolvedPreviewUrl, gl]);
  const load = useStandaloneSceneLoad(loadKey, visible && !previewOnly && Boolean(src || resolvedPreviewUrl));
  const sceneLoad = useContext(SceneLoadSourceContext);
  const { texture, failure } = useEquirectTexture(previewOnly ? "" : src, gl, onLoad, onError);
  const { texture: previewTexture, failure: previewFailure, showDetail } = usePreviewTexture(
    resolvedPreviewUrl,
    configureSpherePreview,
    onPreviewError,
    { showPreviewFirst: visible && !compareSide, discardPreview: texture !== null && !previewOnly },
  );
  const showFullTexture = !previewOnly && showDetail && texture !== null;
  const displayTexture = showFullTexture ? texture : previewTexture;
  const readyRef = useRef(false);
  const detailReporter = useSceneDetailReporter();

  useEffect(() => {
    readyRef.current = false;
  }, [resolvedPreviewUrl, src]);

  useEffect(() => {
    if (!detailReporter) {
      return;
    }
    detailReporter.report(showFullTexture);
    return () => {
      detailReporter.report(false);
    };
  }, [detailReporter, showFullTexture]);

  useEffect(() => {
    if (!displayTexture || readyRef.current) {
      return;
    }
    readyRef.current = true;
    onReady?.();
  }, [displayTexture, onReady]);

  useEffect(() => {
    if (displayTexture) {
      load.current?.ready();
    } else if ((!src || failure) && (!resolvedPreviewUrl || previewFailure)) {
      const error = failure?.error ?? previewFailure?.error ?? new Error("Panorama image source is missing");
      (sceneLoad ?? load.current)?.fail(error);
    }
  }, [displayTexture, failure, load, previewFailure, resolvedPreviewUrl, sceneLoad, src]);

  if (!displayTexture) {
    return null;
  }

  return <SphereSurface texture={displayTexture} yawOffset={yawOffset} visible={visible} />;
}

export const Sphere: (props: SphereProps) => ReturnType<typeof SphereSource> = SphereSource;
