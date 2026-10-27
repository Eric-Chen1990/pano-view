import { useEffect, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import {
  CanvasTexture,
  ClampToEdgeWrapping,
  LinearFilter,
  MathUtils,
  PerspectiveCamera,
  SRGBColorSpace,
  Texture,
} from "three";
import { HotspotAnchor } from "./hotspot-anchor";
import { HotspotPlane } from "./hotspot-plane";
import type { HotspotCommonProps, HotspotScaleMode } from "./types";

const TEXT_TEXTURE_LONG_SIDE = 1024;
/** Extra device pixels so a small zoom still samples the texture downward. */
const TEXT_RASTER_SUPERSAMPLE = 2;
const TEXT_RASTER_MAX_LONG_SIDE = 4096;
const TEXT_RASTER_MIN_LONG_SIDE = 64;
const DEFAULT_REFERENCE_FOV = 75;
const DEFAULT_FONT_FAMILY = "system-ui, sans-serif";
const DEFAULT_FONT_SIZE = 96;
const DEFAULT_COLOR = "#f8fafc";
const DEFAULT_BACKGROUND = "#111827";

export type TextHotspotAlign = "left" | "center" | "right";
export type TextHotspotVerticalAlign = "top" | "middle" | "bottom";
export type TextHotspotWhiteSpace = "normal" | "nowrap";
export type TextHotspotFontStyle = "normal" | "italic";

/** Serializable typography and panel paint for a text hotspot. */
export type TextHotspotStyle = {
  fontFamily?: string;
  /** Canvas pixels. Defaults to 96. */
  fontSize?: number;
  /** CSS font-weight. Defaults to 600. */
  fontWeight?: number | string;
  /** CSS font-style. Defaults to `"normal"`. */
  fontStyle?: TextHotspotFontStyle;
  color?: string;
  /** CSS color. An empty string skips the panel fill. */
  background?: string;
  backgroundOpacity?: number;
  /** Fraction of the texture's shorter side. */
  padding?: number;
  align?: TextHotspotAlign;
  verticalAlign?: TextHotspotVerticalAlign;
  lineHeight?: number;
  whiteSpace?: TextHotspotWhiteSpace;
  /** Fraction of the texture's shorter side, from 0 to 0.5. */
  borderRadius?: number;
  stroke?: string;
  strokeWidth?: number;
};

export type TextHotspotProps = HotspotCommonProps &
  TextHotspotStyle & {
    text: string;
    onLoad?: (texture: Texture) => void;
    onError?: (error: unknown) => void;
  };

function clamp01(value: number | undefined, fallback: number): number {
  if (!Number.isFinite(value)) {
    return fallback;
  }
  return Math.max(0, Math.min(value!, 1));
}

function resolvePositive(value: number | undefined, fallback: number): number {
  return Number.isFinite(value) && value! > 0 ? value! : fallback;
}

function cssFontFamily(family: string): string {
  return family
    .split(",")
    .map((part) => {
      const face = part.trim().replace(/^["']|["']$/g, "");
      if (!face) {
        return "";
      }
      if (/^[a-zA-Z-]+$/.test(face)) {
        return face;
      }
      return `"${face.replace(/"/g, '\\"')}"`;
    })
    .filter(Boolean)
    .join(", ");
}

function resolveTextFont(style: TextHotspotStyle): {
  font: string;
  fontSize: number;
} {
  const fontSize = Math.max(
    1,
    resolvePositive(style.fontSize, DEFAULT_FONT_SIZE),
  );
  const fontFamily = cssFontFamily(
    style.fontFamily?.trim() || DEFAULT_FONT_FAMILY,
  );
  const fontWeight = style.fontWeight ?? 600;
  const fontStyle = style.fontStyle ?? "normal";
  return {
    font: `${fontStyle} ${fontWeight} ${fontSize}px ${fontFamily}`,
    fontSize,
  };
}

function resolveCornerRadius(value: number | undefined): number {
  return Number.isFinite(value) ? Math.max(0, Math.min(value!, 0.5)) : 0.08;
}

function resolveScale(scale: number | undefined): number {
  return Number.isFinite(scale) && scale! > 0 ? scale! : 1;
}

function projectionFov(
  scaleMode: HotspotScaleMode | undefined,
  cameraFov: number,
  referenceFov: number | undefined,
): number {
  const mode = scaleMode ?? "fov";
  switch (mode) {
    case "fixed":
      return resolvePositive(referenceFov, DEFAULT_REFERENCE_FOV);
    case "fov":
      return resolvePositive(cameraFov, DEFAULT_REFERENCE_FOV);
    default: {
      const exhaustive: never = mode;
      return exhaustive;
    }
  }
}

/** Device pixels covered by an angular hotspot extent at the given vertical FOV. */
function projectedDevicePixels(
  angleDeg: number,
  fovDeg: number,
  viewportHeight: number,
): number {
  if (!(viewportHeight > 0)) {
    return 0;
  }
  const fov = Math.min(179, Math.max(1, resolvePositive(fovDeg, DEFAULT_REFERENCE_FOV)));
  const angle = Math.min(179, Math.max(0.01, Math.abs(angleDeg)));
  return (
    (Math.tan(MathUtils.degToRad(angle) / 2) / Math.tan(MathUtils.degToRad(fov) / 2)) *
    viewportHeight
  );
}

/**
 * Long-side bitmap size for the texture actually uploaded.
 * Rounded up from the on-screen size so the GPU never magnifies a mip.
 * `layoutLong` is the 1024-based drawing space `fontSize` is measured in.
 */
function snapRasterLongSide(screenLong: number, layoutLong: number): number {
  if (!(screenLong > 0)) {
    return layoutLong;
  }
  const target = Math.min(
    TEXT_RASTER_MAX_LONG_SIDE,
    Math.max(TEXT_RASTER_MIN_LONG_SIDE, screenLong * TEXT_RASTER_SUPERSAMPLE),
  );
  const step = target >= 512 ? 128 : 64;
  return Math.min(TEXT_RASTER_MAX_LONG_SIDE, Math.ceil(target / step) * step);
}

function textureSize(width: number, height: number): {
  canvasWidth: number;
  canvasHeight: number;
} {
  const safeWidth = resolvePositive(width, 1);
  const safeHeight = resolvePositive(height, 1);
  if (safeWidth >= safeHeight) {
    return {
      canvasWidth: TEXT_TEXTURE_LONG_SIDE,
      canvasHeight: Math.max(
        1,
        Math.round(TEXT_TEXTURE_LONG_SIDE * (safeHeight / safeWidth)),
      ),
    };
  }
  return {
    canvasWidth: Math.max(
      1,
      Math.round(TEXT_TEXTURE_LONG_SIDE * (safeWidth / safeHeight)),
    ),
    canvasHeight: TEXT_TEXTURE_LONG_SIDE,
  };
}

function roundedRectanglePath(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  const safeRadius = Math.max(
    0,
    Math.min(radius, width / 2, height / 2),
  );
  context.beginPath();
  if (safeRadius <= 0) {
    context.rect(x, y, width, height);
    return;
  }
  context.moveTo(x + safeRadius, y);
  context.lineTo(x + width - safeRadius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + safeRadius);
  context.lineTo(x + width, y + height - safeRadius);
  context.quadraticCurveTo(
    x + width,
    y + height,
    x + width - safeRadius,
    y + height,
  );
  context.lineTo(x + safeRadius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - safeRadius);
  context.lineTo(x, y + safeRadius);
  context.quadraticCurveTo(x, y, x + safeRadius, y);
  context.closePath();
}

function wrapLine(
  context: CanvasRenderingContext2D,
  line: string,
  maxWidth: number,
): string[] {
  if (maxWidth <= 0 || context.measureText(line).width <= maxWidth) {
    return [line];
  }

  const lines: string[] = [];
  let current = "";
  for (const word of line.split(" ")) {
    const candidate = current ? `${current} ${word}` : word;
    if (context.measureText(candidate).width <= maxWidth) {
      current = candidate;
      continue;
    }
    if (current) {
      lines.push(current);
    }
    if (context.measureText(word).width <= maxWidth) {
      current = word;
      continue;
    }
    let chunk = "";
    for (const character of word) {
      const nextChunk = chunk + character;
      if (context.measureText(nextChunk).width <= maxWidth || chunk === "") {
        chunk = nextChunk;
      } else {
        lines.push(chunk);
        chunk = character;
      }
    }
    current = chunk;
  }
  if (current) {
    lines.push(current);
  }
  return lines.length > 0 ? lines : [""];
}

function wrapText(
  context: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  nowrap: boolean,
): string[] {
  const paragraphs = text.split("\n");
  if (nowrap) {
    return paragraphs;
  }
  return paragraphs.flatMap((paragraph) => wrapLine(context, paragraph, maxWidth));
}

function drawTextHotspot(
  context: CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number,
  text: string,
  style: TextHotspotStyle,
) {
  const shortSide = Math.min(canvasWidth, canvasHeight);
  const padding = clamp01(style.padding, 0.08) * shortSide;
  const { font, fontSize } = resolveTextFont(style);
  const lineHeight = resolvePositive(style.lineHeight, 1.25) * fontSize;
  const align = style.align ?? "center";
  const verticalAlign = style.verticalAlign ?? "middle";
  const contentWidth = Math.max(1, canvasWidth - padding * 2);
  const contentHeight = Math.max(1, canvasHeight - padding * 2);

  context.clearRect(0, 0, canvasWidth, canvasHeight);
  const background = style.background ?? DEFAULT_BACKGROUND;
  if (background !== "") {
    roundedRectanglePath(
      context,
      0,
      0,
      canvasWidth,
      canvasHeight,
      resolveCornerRadius(style.borderRadius) * shortSide,
    );
    context.save();
    context.globalAlpha = clamp01(style.backgroundOpacity, 0.72);
    context.fillStyle = background;
    context.fill();
    context.restore();
  }

  context.font = font;
  context.textAlign = align;
  context.textBaseline = "top";
  const lines = wrapText(
    context,
    text,
    contentWidth,
    (style.whiteSpace ?? "normal") === "nowrap",
  );
  const maxLines = Math.max(1, Math.floor(contentHeight / lineHeight));
  const visibleLines = lines.slice(0, maxLines);
  const blockHeight = visibleLines.length * lineHeight;
  let startY = padding;
  if (verticalAlign === "middle") {
    startY = padding + Math.max(0, (contentHeight - blockHeight) / 2);
  } else if (verticalAlign === "bottom") {
    startY = padding + Math.max(0, contentHeight - blockHeight);
  }
  const startX =
    align === "left"
      ? padding
      : align === "right"
        ? canvasWidth - padding
        : canvasWidth / 2;
  const color = style.color?.trim() || DEFAULT_COLOR;
  const strokeWidth = Number.isFinite(style.strokeWidth)
    ? Math.max(style.strokeWidth!, 0)
    : 0;

  context.save();
  context.beginPath();
  context.rect(padding, padding, contentWidth, contentHeight);
  context.clip();
  visibleLines.forEach((line, index) => {
    const y = startY + index * lineHeight;
    if (style.stroke && strokeWidth > 0) {
      context.lineWidth = strokeWidth;
      context.strokeStyle = style.stroke;
      context.lineJoin = "round";
      context.miterLimit = 2;
      context.strokeText(line, startX, y);
    }
    context.fillStyle = color;
    context.fillText(line, startX, y);
  });
  context.restore();
}

function createTextTexture(
  text: string,
  width: number,
  height: number,
  style: TextHotspotStyle,
  rasterLong: number,
): CanvasTexture {
  const layout = textureSize(width, height);
  const layoutLong = Math.max(layout.canvasWidth, layout.canvasHeight);
  const scale = (rasterLong > 0 ? rasterLong : layoutLong) / layoutLong;
  const canvasWidth = Math.max(1, Math.round(layout.canvasWidth * scale));
  const canvasHeight = Math.max(1, Math.round(layout.canvasHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Canvas 2D is unavailable for this text hotspot.");
  }
  // Scale absolute canvas-pixel paint into the bitmap. Fractions such as
  // padding already follow the destination size.
  drawTextHotspot(context, canvasWidth, canvasHeight, text, {
    ...style,
    fontSize: resolvePositive(style.fontSize, DEFAULT_FONT_SIZE) * scale,
    strokeWidth: Number.isFinite(style.strokeWidth)
      ? style.strokeWidth! * scale
      : style.strokeWidth,
  });

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.wrapS = ClampToEdgeWrapping;
  texture.wrapT = ClampToEdgeWrapping;
  // Mipmaps pick a level smaller than the screen and magnify it, which
  // softens glyphs. The bitmap is already near the display size.
  texture.magFilter = LinearFilter;
  texture.minFilter = LinearFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}

function useRasterLongSide(
  width: number,
  height: number,
  scale: number | undefined,
  scaleMode: HotspotScaleMode | undefined,
  referenceFov: number | undefined,
): number {
  const size = useThree((state) => state.size);
  const camera = useThree((state) => state.camera);
  const getPixelRatio = useThree((state) => state.gl.getPixelRatio);
  const measure = () => {
    const pixelRatio = getPixelRatio();
    const viewportHeight =
      size.height * (Number.isFinite(pixelRatio) && pixelRatio > 0 ? pixelRatio : 1);
    const cameraFov = camera instanceof PerspectiveCamera ? camera.fov : DEFAULT_REFERENCE_FOV;
    const screenLong = Math.max(
      projectedDevicePixels(
        width * resolveScale(scale),
        projectionFov(scaleMode, cameraFov, referenceFov),
        viewportHeight,
      ),
      projectedDevicePixels(
        height * resolveScale(scale),
        projectionFov(scaleMode, cameraFov, referenceFov),
        viewportHeight,
      ),
    );
    const layout = textureSize(width, height);
    return snapRasterLongSide(
      screenLong,
      Math.max(layout.canvasWidth, layout.canvasHeight),
    );
  };
  const [rasterLong, setRasterLong] = useState(measure);
  const measured = measure();
  if (measured !== rasterLong) {
    setRasterLong(measured);
  }
  // Zoom changes camera.fov without rendering this component again.
  useFrame(() => {
    const next = measure();
    setRasterLong((current) => (current === next ? current : next));
  });
  return rasterLong;
}

function useTextTexture(
  text: string,
  width: number,
  height: number,
  style: TextHotspotStyle,
  scale: number | undefined,
  scaleMode: HotspotScaleMode | undefined,
  referenceFov: number | undefined,
  onLoad: TextHotspotProps["onLoad"],
  onError: TextHotspotProps["onError"],
) {
  const rasterLong = useRasterLongSide(width, height, scale, scaleMode, referenceFov);
  const [texture, setTexture] = useState<Texture | null>(null);
  const onLoadRef = useRef(onLoad);
  const onErrorRef = useRef(onError);
  onLoadRef.current = onLoad;
  onErrorRef.current = onError;

  useEffect(() => {
    let cancelled = false;
    let nextTexture: CanvasTexture | null = null;

    const run = async () => {
      try {
        const layout = textureSize(width, height);
        const layoutLong = Math.max(layout.canvasWidth, layout.canvasHeight);
        const drawScale = rasterLong / layoutLong;
        const { font } = resolveTextFont({
          ...style,
          fontSize: resolvePositive(style.fontSize, DEFAULT_FONT_SIZE) * drawScale,
        });
        try {
          await document.fonts?.load(font);
        } catch {
          // Paint with the fallback face if the requested family is unavailable.
        }
        if (cancelled) {
          return;
        }
        nextTexture = createTextTexture(text, width, height, style, rasterLong);
        setTexture(nextTexture);
        onLoadRef.current?.(nextTexture);
      } catch (error) {
        if (cancelled) {
          return;
        }
        setTexture(null);
        onErrorRef.current?.(error);
      }
    };

    void run();

    return () => {
      cancelled = true;
      nextTexture?.dispose();
    };
  }, [
    height,
    rasterLong,
    style.align,
    style.background,
    style.backgroundOpacity,
    style.borderRadius,
    style.color,
    style.fontFamily,
    style.fontSize,
    style.fontStyle,
    style.fontWeight,
    style.lineHeight,
    style.padding,
    style.stroke,
    style.strokeWidth,
    style.verticalAlign,
    style.whiteSpace,
    text,
    width,
  ]);

  return texture;
}

export function TextHotspot({
  text,
  width = 16,
  height = 6,
  opacity,
  fontFamily,
  fontSize,
  fontWeight,
  fontStyle,
  color,
  background,
  backgroundOpacity,
  padding,
  align,
  verticalAlign,
  lineHeight,
  whiteSpace,
  borderRadius,
  stroke,
  strokeWidth,
  onLoad,
  onError,
  ...anchorProps
}: TextHotspotProps) {
  const style: TextHotspotStyle = {
    align,
    background,
    backgroundOpacity,
    borderRadius,
    color,
    fontFamily,
    fontSize,
    fontStyle,
    fontWeight,
    lineHeight,
    padding,
    stroke,
    strokeWidth,
    verticalAlign,
    whiteSpace,
  };
  const texture = useTextTexture(
    text,
    width,
    height,
    style,
    anchorProps.scale,
    anchorProps.scaleMode,
    anchorProps.referenceFov,
    onLoad,
    onError,
  );

  return (
    <HotspotAnchor {...anchorProps} height={height} width={width}>
      <HotspotPlane map={texture} opacity={opacity} />
    </HotspotAnchor>
  );
}
