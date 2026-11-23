import { SceneLoadSourceContext } from "../scene-load-progress";
import { createPortal } from "@react-three/fiber";
import { useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { DataTexture, DoubleSide, Mesh, MeshBasicMaterial, PerspectiveCamera, Scene as ThreeScene, ShaderMaterial, Vector4, type Texture } from "three";
import type { Node } from "three/webgpu";
import { WebGPURuntimeContext } from "../pano-renderer";
import { toLeveledPanoPosition } from "../level-correction";
import { HotspotLevelCorrectionContext } from "../level-rotation";
import { SceneSource } from "../scenes";
import type { PanoViewerState } from "../types";
import { HotspotAnchor } from "./hotspot-anchor";
import { useHotspotImageTexture } from "./image-hotspot";
import { DEFAULT_PORTAL_FRAME_COLOR, DEFAULT_PORTAL_FRAME_THICKNESS, portalFrameGeometry,
  type PortalHotspotFrame, type PortalHotspotShape } from "./portal-geometry";
import { PortalHostContext } from "./portal-host";
import type { PortalAperture } from "./portal-projection";
import type { HotspotCommonProps } from "./types";

export type PortalHotspotProps = Omit<
  HotspotCommonProps, "mode" | "distance" | "scaleMode" | "referenceFov" | "opacity"
> & {
  targetSceneId: string;
  /** Base view through the portal and the camera view after entering the scene. */
  arrivalView?: PanoViewerState;
  /** Enter when the visitor aims at the opening and zooms in. Defaults to false. */
  enterOnZoom?: boolean;
  shape?: PortalHotspotShape;
  frame?: PortalHotspotFrame;
  /** Called when the destination first paints through this opening. */
  onPreviewReady?: () => void;
  onError?: (error: unknown) => void;
};

const empty = new DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1);
empty.needsUpdate = true;

function useWindowMaterial() {
  const gpu = useContext(WebGPURuntimeContext);
  const visual = useMemo(() => {
    const bounds = new Vector4(0, 0, 1, 1);
    if (gpu) {
      const { modelViewProjection, texture, uniform, vec2, vec4 } = gpu.passes.modules.tsl;
      const area = uniform(bounds);
      const map = texture(empty);
      const clip = modelViewProjection as Node<"vec4">;
      const uv = clip.xy.div(clip.w).mul(0.5).add(0.5).sub(area.xy).div(area.zw).clamp();
      const material = new gpu.passes.modules.three.MeshBasicNodeMaterial({
        toneMapped: false, side: DoubleSide,
      });
      material.colorNode = vec4(map.sample(vec2(uv.x, uv.y.oneMinus())).rgb, 1);
      return { material, bounds, setTexture: (value: Texture) => { map.value = value; } };
    }
    const source = { value: empty as Texture };
    const material = new ShaderMaterial({
      side: DoubleSide, toneMapped: false,
      uniforms: { source, bounds: { value: bounds } },
      vertexShader: `
        varying vec4 clip;
        void main() {
          clip = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          gl_Position = clip;
        }`,
      fragmentShader: `
        varying vec4 clip;
        uniform sampler2D source;
        uniform vec4 bounds;
        void main() {
          vec2 uv = clip.xy / clip.w * 0.5 + 0.5;
          gl_FragColor = vec4(texture2D(source, clamp((uv - bounds.xy) / bounds.zw, 0.0, 1.0)).rgb, 1.0);
          #include <colorspace_fragment>
        }`,
    });
    return { material, bounds, setTexture: (value: Texture) => { source.value = value; } };
  }, [gpu]);
  useEffect(() => () => visual.material.dispose(), [visual]);
  return visual;
}

export function PortalHotspot({
  targetSceneId, width, height, shape = "rectangle", frame, visible = true, ariaLabel, enterOnZoom = false,
  arrivalView, onClick, onPreviewReady, onError, ...anchor
}: PortalHotspotProps) {
  const host = useContext(PortalHostContext);
  const target = host?.scenes.get(targetSceneId);
  const canPreview = Boolean(target && !host?.spatial);
  const mesh = useRef<Mesh>(null);
  const placeholder = useRef<MeshBasicMaterial>(null);
  const [wanted, setWanted] = useState(false);
  const [detail, setDetail] = useState(false);
  const detailRequested = useRef(false);
  const readiness = useRef(false);
  const painted = useRef(false);
  const previewReady = useRef(onPreviewReady);
  previewReady.current = onPreviewReady;
  const sourceLocation = target?.type === "sphere" ? target.src : target?.baseUrl;
  const preview = useMemo(() => new ThreeScene(), [targetSceneId, target?.type, target?.previewUrl, sourceLocation]);
  const camera = useMemo(() => new PerspectiveCamera(), []);
  const visual = useWindowMaterial();
  const outerWidth = width ?? (shape === "circle" ? height ?? 10 : 10);
  const outerHeight = shape === "circle" ? outerWidth : height ?? 16;
  const thickness = frame?.thickness ?? DEFAULT_PORTAL_FRAME_THICKNESS;
  const geometry = useMemo(() =>
    portalFrameGeometry(shape, outerWidth * (anchor.scale ?? 1), outerHeight * (anchor.scale ?? 1), thickness),
  [shape, outerWidth, outerHeight, anchor.scale, thickness]);
  const frameImage = useHotspotImageTexture(frame?.src ?? "", undefined, onError);
  const position = anchor.position;
  const correction = useContext(HotspotLevelCorrectionContext);
  const worldPosition = useMemo(() => toLeveledPanoPosition(position, correction), [position, correction]);
  const activate = onClick ?? (target && host ? () => host.enter(anchor.id, targetSceneId) : undefined);
  const autoEntry = enterOnZoom && anchor.interactive !== false && anchor.pointerEvents !== "none" && activate;
  useLayoutEffect(() => {
    readiness.current = false;
    painted.current = false;
  }, [preview, canPreview]);
  useLayoutEffect(() => {
    if (!host || !mesh.current || !placeholder.current || !target) return;
    const surface = mesh.current;
    const fallback = placeholder.current;
    return host.register(anchor.id, {
      targetId: targetSceneId, arrivalView, position: worldPosition, mesh: mesh.current, outline: geometry.inner, preview, camera,
      visible: () => visible && canPreview,
      ready: () => readiness.current,
      enterOnZoom: autoEntry ? (nativeEvent) => autoEntry({ id: anchor.id, position, nativeEvent, source: "pointer" }) : undefined,
      requestDetail(active) {
        if (active === detailRequested.current) return;
        detailRequested.current = active;
        if (active) setWanted(true);
        setDetail(active);
      },
      show(aperture: PortalAperture | null, texture?: Texture) {
        surface.material = aperture && texture ? visual.material : fallback;
        if (aperture && texture) {
          const { x, y, width, height } = aperture.bounds;
          visual.bounds.set(x, y, width, height);
          visual.setTexture(texture);
          if (!painted.current) {
            painted.current = true;
            previewReady.current?.();
          }
        }
      },
    });
  }, [host, target, preview, camera, geometry, anchor.id, position, worldPosition, targetSceneId, arrivalView, visible, canPreview, visual, autoEntry]);

  return (
    <HotspotAnchor
      {...anchor} visible={visible} width={outerWidth} height={outerHeight} mode="surface"
      ariaLabel={ariaLabel ?? targetSceneId}
      onClick={activate}
    >
      <mesh ref={mesh}>
        {/* Fiber owns the mounted geometry so StrictMode effect replay does not release its GPU buffers. */}
        <bufferGeometry
          key={geometry.window.uuid}
          index={geometry.window.index}
          attributes={geometry.window.attributes}
        />
        <meshBasicMaterial ref={placeholder} color="#172b32" side={DoubleSide} toneMapped={false} />
      </mesh>
      {frameImage ? (
        <mesh key="frame-image" raycast={() => {}}>
          <planeGeometry args={[1, 1]} />
          {/* The image intentionally overlaps the coplanar aperture. Bias its
              depth so the two surfaces stay ordered at panorama distances. */}
          <meshBasicMaterial
            map={frameImage}
            transparent
            alphaTest={0.01}
            depthWrite={false}
            polygonOffset
            polygonOffsetFactor={-1}
            polygonOffsetUnits={-4}
            side={DoubleSide}
            toneMapped={false}
          />
        </mesh>
      ) : geometry.hasBorder ? (
        <mesh key="frame-solid" raycast={() => {}}>
          <bufferGeometry
            key={geometry.frame.uuid}
            index={geometry.frame.index}
            attributes={geometry.frame.attributes}
          />
          <meshBasicMaterial color={frame?.color ?? DEFAULT_PORTAL_FRAME_COLOR} side={DoubleSide} toneMapped={false} />
        </mesh>
      ) : null}
      {wanted && canPreview ? createPortal(
        <SceneLoadSourceContext.Provider value={null}>
          <SceneSource scene={target ?? null} visible baseOnly={false} previewOnly={!detail}
            onReady={() => { readiness.current = true; }}
            onError={(error) => onError?.(error)}
            onPreviewError={(error) => onError?.(error)}
          />
        </SceneLoadSourceContext.Provider>, preview, { camera, events: { enabled: false } },
      ) : null}
    </HotspotAnchor>
  );
}
