import { tooltipPadding, tooltipBaseline, tooltipLines } from "./tooltip-layout";
import { spatialTooltipWorldMatrix } from "./tooltip-transform";
import { WebVRRuntimeContext } from "../webvr/host";
import { useContext, useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import {
  CanvasTexture,
  LinearFilter,
  SRGBColorSpace,
  Mesh,
  Matrix4,
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

/** Spatial plane: both eyes, depth ordering, and the final lens mask apply. */
export function SpatialHotspotTooltip(props: {
  mode: HotspotMode;
  scaleMode: HotspotScaleMode;
  referenceFov: number;
  content: HotspotTooltipContent;
  appearance: Required<HotspotTooltipAppearance>;
  placement: HotspotTooltipPlacement;
  offset: number;
}) {
  const { content, appearance } = props;
  const mesh = useRef<Mesh>(null);
  const { camera, gl, size } = useThree();
  const stereoView = useContext(WebVRRuntimeContext)?.stereoView;
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
    const border = /^(\d+(?:\.\d+)?)px\s+solid\s+(.+)$/.exec(appearance.border);
    const borderWidth = Math.min(number(border?.[1] ?? 0, 1), 2 * Math.max(width, height));
    // Leave transparent texels beyond the centered stroke for linear filtering.
    const gutter = Math.max(2, Math.ceil(borderWidth / 2) + 1);
    const textureWidth = width + 2 * gutter;
    const textureHeight = height + 2 * gutter;
    canvas.width = textureWidth * 2;
    canvas.height = textureHeight * 2;
    ctx.scale(2, 2);
    ctx.translate(gutter, gutter);
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
    if (border) {
      ctx.strokeStyle = border[2]!;
      ctx.lineWidth = borderWidth;
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
    return { texture, width, height, textureWidth, textureHeight };
  }, [appearance, content.text, image]);
  useEffect(() => () => raster.texture.dispose(), [raster]);
  const scratch = useMemo(
    () => ({
      world: new Matrix4(),
      local: new Matrix4(),
    }),
    [],
  );
  useFrame(() => {
    const node = mesh.current;
    if (!node?.parent) return;
    const presenting = gl.xr.isPresenting;
    const view = presenting ? gl.xr.getCamera() : camera;
    const projectionScaleY = !presenting && stereoView?.active
      ? stereoView.projectionScaleY ?? view.projectionMatrix.elements[5]!
      : view.projectionMatrix.elements[5]!;
    spatialTooltipWorldMatrix(
      scratch.world,
      node.parent,
      view,
      size.height,
      projectionScaleY,
      props,
      raster,
    );
    scratch.local
      .copy(node.parent.matrixWorld)
      .invert()
      .multiply(scratch.world);
    node.matrixAutoUpdate = false;
    node.matrix.copy(scratch.local);
    node.matrixWorldNeedsUpdate = true;
  });

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
}
