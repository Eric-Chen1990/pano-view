import { tooltipPadding, tooltipBaseline, tooltipLines } from "./tooltip-layout";
import { tooltipWorldMatrix } from "./tooltip-transform";
import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import {
  CanvasTexture,
  LinearFilter,
  SRGBColorSpace,
  Sprite,
  Mesh,
  Matrix4,
  Quaternion,
  Vector3,
} from "three";
import type {
  HotspotMode,
  HotspotScaleMode,
  HotspotTooltipAppearance,
  HotspotTooltipContent,
  HotspotTooltipPlacement,
} from "./types";

function number(value: string | number, fallback: number) {
  const parsed = typeof value === "number" ? value : parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/** A real scene sprite: both eyes, depth ordering and the final lens mask apply. */
export function SpatialHotspotTooltip({
  content,
  mode,
  scaleMode,
  referenceFov,
  appearance,
  placement,
  offset,
}: {
  mode: HotspotMode;
  scaleMode: HotspotScaleMode;
  referenceFov: number;
  content: HotspotTooltipContent;
  appearance: Required<HotspotTooltipAppearance>;
  placement: HotspotTooltipPlacement;
  offset: number;
}) {
  const sprite = useRef<Sprite>(null);
  const mesh = useRef<Mesh>(null);
  const { camera, gl, size } = useThree();
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  useEffect(() => {
    setImage(null);
    if (!content.image) return;
    let disposed = false;
    const resource = new Image();
    resource.crossOrigin = "anonymous";
    resource.onload = () => {
      if (!disposed) setImage(resource);
    };
    resource.src = content.image;
    return () => {
      disposed = true;
      resource.onload = null;
    };
  }, [content.image]);
  const raster = useMemo(() => {
    const fontSize = Math.max(1, number(appearance.fontSize, 12));
    const [pt, pr, pb, pl] = tooltipPadding(appearance.padding);
    const padding = Math.max(pl, pr);
    const letterSpacing = appearance.letterSpacing === "normal" ? 0 : number(appearance.letterSpacing ?? 0, 0);
    const leading = appearance.lineHeight;
    const lineHeight =
      typeof leading === "string" && leading.endsWith("px")
        ? number(leading, fontSize * 1.4)
        : (fontSize * number(leading, 1.4)) /
          (typeof leading === "string" && leading.endsWith("%") ? 100 : 1);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d")!;
    const font = `${fontSize}px ${appearance.fontFamily}`;
    ctx.font = font;
    const measure = (text: string) => (letterSpacing ? [...text].reduce((width, char) => width + ctx.measureText(char).width, 0) : ctx.measureText(text).width) + Math.max(0, [...text].length - 1) * letterSpacing;
    const lines = tooltipLines(content.text ?? "", 220 - pl - pr, measure);
    const imageWidth = image
      ? Math.min(
          220 - padding * 2,
          (120 * image.naturalWidth) / image.naturalHeight
        )
      : 0;
    const imageHeight = image
      ? (imageWidth * image.naturalHeight) / image.naturalWidth
      : 0;
    const width = Math.ceil(
      Math.max(
        imageWidth,
        ...lines.map(measure),
        1
      ) +
        pl + pr
    );
    const height = Math.ceil(
      pt + pb +
        imageHeight +
        (image && lines.length ? padding : 0) +
        lines.length * lineHeight
    );
    canvas.width = width * 2;
    canvas.height = height * 2;
    ctx.scale(2, 2);
    ctx.beginPath();
    ctx.roundRect(
      0,
      0,
      width,
      height,
      Math.max(0, number(appearance.borderRadius, 8))
    );
    ctx.fillStyle = appearance.background;
    ctx.fill();
    const border = /^(\d+(?:\.\d+)?)px\s+solid\s+(.+)$/.exec(appearance.border);
    if (border) {
      ctx.strokeStyle = border[2]!;
      ctx.lineWidth = Number(border[1]);
      ctx.stroke();
    }
    ctx.save();
    ctx.clip();
    let top = pt;
    if (image) {
      ctx.drawImage(image, pl, top, imageWidth, imageHeight);
      top += imageHeight + padding;
    }
    ctx.font = font;
    ctx.fillStyle = appearance.color;
    ctx.textBaseline = "alphabetic";
    lines.forEach((line, i) => {
      const metrics = ctx.measureText(line || "Mg");
      const ascent = metrics.actualBoundingBoxAscent || fontSize * .8;
      const descent = metrics.actualBoundingBoxDescent ?? fontSize * .2;
      let x = pl;
      const y = tooltipBaseline(top + i * lineHeight, lineHeight, ascent, descent);
      if (!letterSpacing) ctx.fillText(line, x, y);
      else for (const char of line) { ctx.fillText(char, x, y); x += ctx.measureText(char).width + letterSpacing; }
    });
    ctx.restore();
    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    texture.minFilter = LinearFilter;
    texture.generateMipmaps = false;
    return { texture, width, height };
  }, [appearance, content.text, image]);
  useEffect(() => () => raster.texture.dispose(), [raster]);
  const scratch = useMemo(
    () => ({
      world: new Matrix4(),
      local: new Matrix4(),
      point: new Vector3(),
      offset: new Vector3(),
      rotation: new Quaternion(),
      scale: new Vector3(),
    }),
    [],
  );
  useFrame(() => {
    const node = mode === "surface" ? mesh.current : sprite.current;
    if (!node?.parent) return;
    const view = gl.xr.isPresenting ? gl.xr.getCamera() : camera;
    tooltipWorldMatrix(
      scratch.world,
      node.parent,
      view,
      size.height,
      mode,
      scaleMode,
      referenceFov,
    );
    const unit = scratch.scale.setFromMatrixScale(scratch.world).x;
    const depth = -scratch.point
      .setFromMatrixPosition(scratch.world)
      .applyMatrix4(camera.matrixWorldInverse).z;
    const pixel =
      (2 * Math.max(0, depth)) /
      (Math.max(1, size.height) * camera.projectionMatrix.elements[5]!);
    const x =
      placement === "left"
        ? (-raster.width * unit) / 2 - offset * pixel
        : placement === "right"
          ? (raster.width * unit) / 2 + offset * pixel
          : 0;
    const y =
      placement === "top"
        ? (raster.height * unit) / 2 + offset * pixel
        : placement === "bottom"
          ? (-raster.height * unit) / 2 - offset * pixel
          : 0;
    scratch.world.decompose(scratch.point, scratch.rotation, scratch.scale);
    scratch.point.add(
      scratch.offset.set(x, y, 0).applyQuaternion(scratch.rotation),
    );
    scratch.world.compose(
      scratch.point,
      scratch.rotation,
      scratch.scale.set(raster.width * unit, raster.height * unit, 1),
    );
    scratch.local
      .copy(node.parent.matrixWorld)
      .invert()
      .multiply(scratch.world);
    node.matrixAutoUpdate = false;
    node.matrix.copy(scratch.local);
    node.matrixWorldNeedsUpdate = true;
  });

  if (mode === "surface")
    return (
      <mesh ref={mesh} renderOrder={1000} raycast={() => {}}>
        <planeGeometry />
        <meshBasicMaterial
          map={raster.texture}
          transparent
          depthTest={false}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
    );
  return (
    <sprite ref={sprite} renderOrder={1000} raycast={() => {}}>
      <spriteMaterial
        map={raster.texture}
        transparent
        depthTest={false}
        depthWrite={false}
        toneMapped={false}
      />
    </sprite>
  );
}
