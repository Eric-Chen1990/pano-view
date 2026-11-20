import { useContext, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { CanvasTexture, LinearFilter, LinearMipmapLinearFilter, Matrix4, Mesh, SRGBColorSpace } from "three";
import { getMaxTextureSize, getTextureAnisotropy } from "../renderer-capabilities";
import { getWebVRHotspotView, WebVRRuntimeContext } from "../webvr/host";
import { rasterizeTooltip } from "./tooltip-raster";
import { tooltipRasterScale } from "./tooltip-layout";
import { spatialTooltipWorldMatrix, tooltipReferenceSlope } from "./tooltip-transform";
import type { HotspotMode, HotspotScaleMode, HotspotTooltipContent, HotspotTooltipPlacement } from "./types";

type Raster = NonNullable<ReturnType<typeof rasterizeTooltip>> & { texture: CanvasTexture };
type RasterLayout = { width: number; resolution: number };

export function SpatialHotspotTooltip(props: {
  mode: HotspotMode;
  scaleMode: HotspotScaleMode;
  referenceFov: number;
  content: HotspotTooltipContent;
  style: CSSProperties;
  placement: HotspotTooltipPlacement;
  offset: number;
}) {
  const { content, style } = props;
  const mesh = useRef<Mesh>(null);
  const world = useRef(new Matrix4());
  const gl = useThree(state => state.gl);
  const eventsTarget = useThree(state => state.events.connected);
  const runtime = useContext(WebVRRuntimeContext);
  const [loaded, setLoaded] = useState<{ src: string; image: HTMLImageElement } | null>(null);
  const [raster, setRaster] = useState<Raster | null>(null);
  const layoutRef = useRef<RasterLayout | null>(null);
  const [layout, setLayout] = useState<RasterLayout | null>(null);
  const image = loaded?.src === content.image ? loaded?.image ?? null : null;
  const fixed = props.mode === "billboard" && props.scaleMode === "fixed";
  const referenceSlope = tooltipReferenceSlope(props.referenceFov);

  useEffect(() => {
    const src = content.image;
    if (!src) return;
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => setLoaded({ src, image });
    image.onerror = () => setLoaded(null);
    image.src = src;
    return () => {
      image.onload = null;
      image.onerror = null;
    };
  }, [content.image]);

  useLayoutEffect(() => {
    const parent = eventsTarget instanceof HTMLElement ? eventsTarget : gl.domElement.parentElement;
    if (!parent || !layout) return;
    const label = content.text ?? "";
    const update = () => {
      const next = rasterizeTooltip(parent, style, label, image, layout.width, layout.resolution, getMaxTextureSize(gl));
      if (next) {
        const texture = new CanvasTexture(next.canvas);
        texture.colorSpace = SRGBColorSpace;
        texture.magFilter = LinearFilter;
        texture.minFilter = LinearMipmapLinearFilter;
        texture.generateMipmaps = true;
        texture.anisotropy = Math.min(4, getTextureAnisotropy(gl));
        setRaster({ ...next, texture });
      } else {
        setRaster(null);
      }
      return next?.font;
    };
    const font = update();
    const fonts = document.fonts;
    fonts?.addEventListener("loadingdone", update);
    if (label && font) void fonts?.load(font, label).catch(() => {});
    return () => {
      fonts?.removeEventListener("loadingdone", update);
    };
  }, [layout, content.text, eventsTarget, gl, image, style]);
  useEffect(() => () => raster?.texture.dispose(), [raster]);

  useFrame(() => {
    const view = runtime && getWebVRHotspotView(runtime, gl.xr.isPresenting);
    const height = runtime?.host.hotspotReferenceHeight ?? 1;
    if (view?.projectionScaleY) {
      const zoom = fixed ? 1 : view.projectionScaleY * referenceSlope;
      const width = Math.max(1, Math.floor(0.8 * height * view.commonWidthPerHeight / zoom));
      const resolution = tooltipRasterScale(view.renderHeight, height, zoom);
      if (layoutRef.current?.width !== width || layoutRef.current.resolution !== resolution) {
        const next = { width, resolution };
        layoutRef.current = next;
        setLayout(next);
      }
    }
    const node = mesh.current;
    if (!node?.parent || !raster) return;
    node.visible = Boolean(view?.projectionScaleY && spatialTooltipWorldMatrix(
      world.current, node.parent, view.camera, height, props, raster,
    ));
    if (!node.visible) return;
    node.matrix.copy(node.parent.matrixWorld).invert().multiply(world.current);
    node.updateMatrixWorld(true);
  }, runtime?.mode === "webxr" ? -70 : -0.25);

  if (!raster) return null;
  return (
    <mesh ref={mesh} matrixAutoUpdate={false} visible={false} renderOrder={1000} raycast={() => {}}>
      <planeGeometry />
      <meshBasicMaterial map={raster.texture} transparent depthTest={false} depthWrite={false} toneMapped={false} />
    </mesh>
  );
}
