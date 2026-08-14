import { useEffect, useRef, useState } from "react";
import {
  CanvasTexture,
  ClampToEdgeWrapping,
  DoubleSide,
  LinearFilter,
  SRGBColorSpace,
  Texture,
} from "three";
import { HotspotAnchor } from "./hotspot-anchor";
import { ImageHotspot } from "./image-hotspot";
import type { HotspotCommonProps } from "./types";

const GRAPHIC_TEXTURE_SIZE = 512;

type GraphicPaint = {
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
};

export type CircleGraphic = GraphicPaint & {
  kind: "circle";
};

export type RectangleGraphic = GraphicPaint & {
  kind: "rectangle";
  cornerRadius?: number;
};

export type RingGraphic = GraphicPaint & {
  kind: "ring";
  innerRadius?: number;
};

export type SvgGraphic = {
  kind: "svg";
  src: string;
};

export type SvgPathGraphic = GraphicPaint & {
  kind: "path";
  path: string;
  viewBox: [x: number, y: number, width: number, height: number];
};

export type GraphicDefinition =
  | CircleGraphic
  | RectangleGraphic
  | RingGraphic
  | SvgGraphic
  | SvgPathGraphic;

export type GraphicHotspotProps = HotspotCommonProps & {
  graphic: GraphicDefinition;
  onLoad?: (texture: Texture) => void;
  onError?: (error: unknown) => void;
};

function clampOpacity(opacity: number | undefined): number {
  if (!Number.isFinite(opacity)) {
    return 1;
  }
  return Math.max(0, Math.min(opacity!, 1));
}

function resolveStrokeWidth(value: number | undefined): number {
  return Number.isFinite(value) ? Math.max(value!, 0) : 8;
}

function roundedRectanglePath(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  const safeRadius = Math.min(Math.max(radius, 0), width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + safeRadius, y);
  context.arcTo(x + width, y, x + width, y + height, safeRadius);
  context.arcTo(x + width, y + height, x, y + height, safeRadius);
  context.arcTo(x, y + height, x, y, safeRadius);
  context.arcTo(x, y, x + width, y, safeRadius);
  context.closePath();
}

function paintPath(
  context: CanvasRenderingContext2D,
  graphic: GraphicPaint,
  path?: Path2D,
) {
  if (graphic.fill) {
    context.fillStyle = graphic.fill;
    path ? context.fill(path) : context.fill();
  }
  if (graphic.stroke) {
    context.strokeStyle = graphic.stroke;
    context.lineWidth = resolveStrokeWidth(graphic.strokeWidth);
    path ? context.stroke(path) : context.stroke();
  }
}

function drawGraphic(
  context: CanvasRenderingContext2D,
  graphic: Exclude<GraphicDefinition, SvgGraphic>,
) {
  const padding = Math.max(resolveStrokeWidth(graphic.strokeWidth) / 2 + 2, 4);
  const drawableSize = GRAPHIC_TEXTURE_SIZE - padding * 2;

  context.clearRect(0, 0, GRAPHIC_TEXTURE_SIZE, GRAPHIC_TEXTURE_SIZE);
  context.lineJoin = "round";
  context.lineCap = "round";

  if (graphic.kind === "circle") {
    context.beginPath();
    context.arc(
      GRAPHIC_TEXTURE_SIZE / 2,
      GRAPHIC_TEXTURE_SIZE / 2,
      drawableSize / 2,
      0,
      Math.PI * 2,
    );
    paintPath(context, graphic);
    return;
  }

  if (graphic.kind === "rectangle") {
    roundedRectanglePath(
      context,
      padding,
      padding,
      drawableSize,
      drawableSize,
      graphic.cornerRadius ?? 0,
    );
    paintPath(context, graphic);
    return;
  }

  if (graphic.kind === "ring") {
    const center = GRAPHIC_TEXTURE_SIZE / 2;
    const outerRadius = drawableSize / 2;
    const innerRadius = Math.max(
      0,
      Math.min(outerRadius - 1, (graphic.innerRadius ?? 0.58) * outerRadius),
    );
    context.beginPath();
    context.arc(center, center, outerRadius, 0, Math.PI * 2);
    context.moveTo(center + innerRadius, center);
    context.arc(center, center, innerRadius, 0, Math.PI * 2, true);
    if (graphic.fill ?? graphic.stroke) {
      context.fillStyle = graphic.fill ?? graphic.stroke ?? "#ffffff";
      context.fill("evenodd");
    }
    if (graphic.stroke) {
      context.strokeStyle = graphic.stroke;
      context.lineWidth = resolveStrokeWidth(graphic.strokeWidth);
      context.stroke();
    }
    return;
  }

  const [x, y, width, height] = graphic.viewBox;
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    throw new Error("SVG path viewBox must have a positive width and height.");
  }
  const path = new Path2D(graphic.path);
  context.save();
  context.translate(padding, padding);
  context.scale(drawableSize / width, drawableSize / height);
  context.translate(-x, -y);
  paintPath(context, graphic, path);
  context.restore();
}

function createGraphicTexture(
  graphic: Exclude<GraphicDefinition, SvgGraphic>,
): CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = GRAPHIC_TEXTURE_SIZE;
  canvas.height = GRAPHIC_TEXTURE_SIZE;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Canvas 2D is unavailable for this graphic hotspot.");
  }
  drawGraphic(context, graphic);

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.wrapS = ClampToEdgeWrapping;
  texture.wrapT = ClampToEdgeWrapping;
  texture.magFilter = LinearFilter;
  texture.minFilter = LinearFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}

function useGraphicTexture(
  graphic: Exclude<GraphicDefinition, SvgGraphic>,
  onLoad: GraphicHotspotProps["onLoad"],
  onError: GraphicHotspotProps["onError"],
) {
  const [texture, setTexture] = useState<CanvasTexture | null>(null);
  const onLoadRef = useRef(onLoad);
  const onErrorRef = useRef(onError);
  onLoadRef.current = onLoad;
  onErrorRef.current = onError;

  useEffect(() => {
    let nextTexture: CanvasTexture | null = null;
    try {
      nextTexture = createGraphicTexture(graphic);
      setTexture(nextTexture);
      onLoadRef.current?.(nextTexture);
    } catch (error) {
      setTexture(null);
      onErrorRef.current?.(error);
    }

    return () => {
      nextTexture?.dispose();
    };
  }, [graphic]);

  return texture;
}

function CanvasGraphicHotspot({
  graphic,
  width = 10,
  height = 10,
  opacity,
  onLoad,
  onError,
  ...anchorProps
}: GraphicHotspotProps & { graphic: Exclude<GraphicDefinition, SvgGraphic> }) {
  const texture = useGraphicTexture(graphic, onLoad, onError);

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

export function GraphicHotspot(props: GraphicHotspotProps) {
  const { graphic, ...restProps } = props;
  if (graphic.kind === "svg") {
    const imageProps = restProps;
    return <ImageHotspot {...imageProps} src={graphic.src} />;
  }

  return <CanvasGraphicHotspot {...restProps} graphic={graphic} />;
}
