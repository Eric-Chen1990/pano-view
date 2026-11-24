import {
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";
import { useFrame, useThree } from "@react-three/fiber";
import {
  CanvasTexture,
  LinearFilter,
  LinearMipmapLinearFilter,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  Quaternion,
  SRGBColorSpace,
  Vector3,
} from "three";
import {
  getMaxTextureSize,
  getTextureAnisotropy,
} from "../renderer-capabilities";
import { getWebVRHotspotView, WebVRRuntimeContext } from "../webvr/host";
import {
  resolveCalloutAppearance,
  resolveCalloutLayout,
  resolveCalloutLine,
  type CalloutAppearance,
  type CalloutContent,
  type CalloutLine,
  type CalloutRevealProgress,
} from "./callout-layout";
import { rasterizeCallout } from "./callout-raster";
import { tooltipRasterScale } from "./tooltip-layout";
import {
  setTooltipWorldFrame,
  tooltipReferenceSlope,
} from "./tooltip-transform";

type Raster = NonNullable<ReturnType<typeof rasterizeCallout>> & {
  texture: CanvasTexture;
};

const scratch = {
  lineDirection: new Vector3(),
  cameraRight: new Vector3(),
  cameraUp: new Vector3(),
  cameraRotation: new Quaternion(),
  zRotation: new Quaternion(),
  spin: new Quaternion(),
  axis: new Vector3(0, 0, 1),
  origin: new Vector3(),
  mid: new Vector3(),
  scale: new Vector3(),
  world: new Matrix4(),
  local: new Matrix4(),
};

export function SpatialCallout({
  content,
  line,
  appearance,
  progress,
}: {
  content: CalloutContent;
  line?: CalloutLine;
  appearance?: CalloutAppearance;
  progress: RefObject<CalloutRevealProgress>;
}) {
  const resolvedLine = useMemo(() => resolveCalloutLine(line), [line]);
  const resolvedAppearance = useMemo(
    () => resolveCalloutAppearance(appearance, resolvedLine.color),
    [appearance, resolvedLine.color],
  );
  const layout = useMemo(
    () => resolveCalloutLayout(resolvedLine.angle, resolvedLine.length),
    [resolvedLine.angle, resolvedLine.length],
  );
  const lineMesh = useRef<Mesh>(null);
  const cardMesh = useRef<Mesh>(null);
  const lineMaterial = useRef<MeshBasicMaterial>(null);
  const cardMaterial = useRef<MeshBasicMaterial>(null);
  const gl = useThree((state) => state.gl);
  const eventsTarget = useThree((state) => state.events.connected);
  const runtime = useContext(WebVRRuntimeContext);
  const [loaded, setLoaded] = useState<{
    src: string;
    image: HTMLImageElement;
  } | null>(null);
  const [raster, setRaster] = useState<Raster | null>(null);
  const paintRef = useRef<{ width: number; resolution: number } | null>(null);
  const [paintLayout, setPaintLayout] = useState<{
    width: number;
    resolution: number;
  } | null>(null);
  const image = loaded?.src === content.image ? (loaded?.image ?? null) : null;
  const referenceSlope = tooltipReferenceSlope(75);
  const accentOnLeft = layout.card.horizontal === "right";

  useEffect(() => {
    const src = content.image;
    if (!src) return;
    const next = new Image();
    next.crossOrigin = "anonymous";
    next.onload = () => setLoaded({ src, image: next });
    next.onerror = () => setLoaded(null);
    next.src = src;
    return () => {
      next.onload = null;
      next.onerror = null;
    };
  }, [content.image]);

  useLayoutEffect(() => {
    const parent =
      eventsTarget instanceof HTMLElement
        ? eventsTarget
        : gl.domElement.parentElement;
    if (!parent || !paintLayout) return;
    const update = () => {
      const next = rasterizeCallout(
        content,
        {
          width: resolvedAppearance.width,
          background: resolvedAppearance.background,
          color: resolvedAppearance.color,
          titleBackground: resolvedAppearance.titleBackground,
          titleColor: resolvedAppearance.titleColor,
          accentColor: resolvedAppearance.accentColor,
          fontSize: resolvedAppearance.fontSize,
          padding: resolvedAppearance.padding,
          borderRadius: resolvedAppearance.borderRadius,
          accentWidth: resolvedLine.width,
          accentOnLeft,
        },
        image,
        paintLayout.resolution,
        getMaxTextureSize(gl),
      );
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
    if ((content.title || content.text) && font) {
      void fonts
        ?.load(font, `${content.title ?? ""}${content.text ?? ""}`)
        .catch(() => {});
    }
    return () => {
      fonts?.removeEventListener("loadingdone", update);
    };
  }, [
    accentOnLeft,
    content,
    eventsTarget,
    gl,
    image,
    paintLayout,
    resolvedAppearance,
    resolvedLine.width,
  ]);

  useEffect(() => () => raster?.texture.dispose(), [raster]);

  useFrame(() => {
    const view = runtime && getWebVRHotspotView(runtime, gl.xr.isPresenting);
    const height = runtime?.host.hotspotReferenceHeight ?? 1;
    if (view?.projectionScaleY) {
      const zoom = view.projectionScaleY * referenceSlope;
      const width = Math.max(
        1,
        Math.floor((0.8 * height * view.commonWidthPerHeight) / zoom),
      );
      const resolution = tooltipRasterScale(view.renderHeight, height, zoom);
      if (
        paintRef.current?.width !== width ||
        paintRef.current.resolution !== resolution
      ) {
        const next = { width, resolution };
        paintRef.current = next;
        setPaintLayout(next);
      }
    }

    const reveal = progress.current ?? {
      lineProgress: 0,
      contentProgress: 0,
    };
    const camera = view?.camera;
    const anchor = lineMesh.current?.parent ?? cardMesh.current?.parent;
    if (!camera || !anchor) return;

    const { unit, depth } = setTooltipWorldFrame(
      anchor,
      camera,
      height,
      "billboard",
      "fixed",
      75,
    );
    if (!(depth > 0) || !(unit > 0)) {
      if (lineMesh.current) lineMesh.current.visible = false;
      if (cardMesh.current) cardMesh.current.visible = false;
      return;
    }

    camera.getWorldQuaternion(scratch.cameraRotation);
    scratch.cameraRight.set(1, 0, 0).applyQuaternion(scratch.cameraRotation);
    scratch.cameraUp.set(0, 1, 0).applyQuaternion(scratch.cameraRotation);
    const radians = (layout.angle * Math.PI) / 180;
    scratch.lineDirection
      .copy(scratch.cameraRight)
      .multiplyScalar(Math.cos(radians))
      .addScaledVector(scratch.cameraUp, Math.sin(radians))
      .normalize();

    const lineLength = layout.length * reveal.lineProgress * unit;
    const lineWidth = Math.max(1e-4, resolvedLine.width * unit);
    anchor.getWorldPosition(scratch.origin);

    if (lineMesh.current && lineMaterial.current) {
      scratch.mid
        .copy(scratch.origin)
        .addScaledVector(scratch.lineDirection, lineLength / 2);
      scratch.zRotation.setFromAxisAngle(scratch.axis, radians);
      scratch.spin.copy(scratch.cameraRotation).multiply(scratch.zRotation);
      scratch.world.compose(
        scratch.mid,
        scratch.spin,
        scratch.scale.set(Math.max(1e-4, lineLength), lineWidth, 1),
      );
      scratch.local.copy(anchor.matrixWorld).invert().multiply(scratch.world);
      lineMesh.current.matrix.copy(scratch.local);
      lineMesh.current.updateMatrixWorld(true);
      lineMesh.current.visible = reveal.lineProgress > 0.001;
      lineMaterial.current.color.set(resolvedLine.color);
      lineMaterial.current.opacity = 1;
      lineMaterial.current.needsUpdate = true;
    }

    if (cardMesh.current && cardMaterial.current && raster) {
      scratch.mid
        .copy(scratch.origin)
        .addScaledVector(scratch.lineDirection, layout.length * unit);
      const cardWidth = raster.width * unit;
      const cardHeight = raster.height * unit;
      const xSign = layout.card.horizontal === "right" ? 1 : -1;
      const ySign =
        layout.card.vertical === "end"
          ? 1
          : layout.card.vertical === "start"
            ? -1
            : 0;
      scratch.mid.addScaledVector(
        scratch.cameraRight,
        xSign * (cardWidth / 2),
      );
      scratch.mid.addScaledVector(scratch.cameraUp, ySign * (cardHeight / 2));
      const contentScale = Math.max(0.001, reveal.contentProgress);
      scratch.world.compose(
        scratch.mid,
        scratch.cameraRotation,
        scratch.scale.set(cardWidth * contentScale, cardHeight, 1),
      );
      scratch.local.copy(anchor.matrixWorld).invert().multiply(scratch.world);
      cardMesh.current.matrix.copy(scratch.local);
      cardMesh.current.updateMatrixWorld(true);
      cardMesh.current.visible = reveal.contentProgress > 0.001;
      cardMaterial.current.opacity = reveal.contentProgress;
      if (cardMaterial.current.map !== raster.texture) {
        cardMaterial.current.map = raster.texture;
      }
      cardMaterial.current.needsUpdate = true;
    } else if (cardMesh.current) {
      cardMesh.current.visible = false;
    }
  }, runtime?.mode === "webxr" ? -70 : -0.25);

  return (
    <>
      <mesh
        ref={lineMesh}
        matrixAutoUpdate={false}
        visible={false}
        renderOrder={1000}
        raycast={() => {}}
      >
        <planeGeometry />
        <meshBasicMaterial
          ref={lineMaterial}
          color={resolvedLine.color}
          transparent
          depthTest={false}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      <mesh
        ref={cardMesh}
        matrixAutoUpdate={false}
        visible={false}
        renderOrder={1001}
        raycast={() => {}}
      >
        <planeGeometry />
        <meshBasicMaterial
          ref={cardMaterial}
          transparent
          depthTest={false}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
    </>
  );
}
