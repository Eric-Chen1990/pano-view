import { useEffect, useRef, useState } from "react";
import {
  CanvasTexture,
  ClampToEdgeWrapping,
  LinearFilter,
  LinearMipmapLinearFilter,
  SRGBColorSpace,
  Texture,
} from "three";
import { HotspotAnchor } from "./hotspot-anchor";
import { HotspotPlane } from "./hotspot-plane";
import type { HotspotCommonProps } from "./types";

const TEXT_TEXTURE_LONG_SIDE = 1024;
const DEFAULT_FONT_FAMILY = "system-ui, sans-serif";
const DEFAULT_COLOR = "#f8fafc";
const DEFAULT_BACKGROUND = "#111827";

export type TextHotspotAlign = "left" | "center" | "right";
export type TextHotspotVerticalAlign = "top" | "middle" | "bottom";
export type TextHotspotWhiteSpace = "normal" | "nowrap";
export type TextHotspotFontStyle = "normal" | "italic";

/** Serializable typography and panel paint for a text hotspot. */
export type TextHotspotStyle = {
  fontFamily?: string;
  /** Fraction of the texture height. Defaults to 0.18. */
  fontSize?: number;
  fontWeight?: number | string;
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

function resolveCornerRadius(value: number | undefined): number {
  return Number.isFinite(value) ? Math.max(0, Math.min(value!, 0.5)) : 0.08;
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
  const fontSize = Math.max(1, clamp01(style.fontSize, 0.18) * canvasHeight);
  const lineHeight = resolvePositive(style.lineHeight, 1.25) * fontSize;
  const align = style.align ?? "center";
  const verticalAlign = style.verticalAlign ?? "middle";
  const fontFamily = style.fontFamily?.trim() || DEFAULT_FONT_FAMILY;
  const fontWeight = style.fontWeight ?? 600;
  const fontStyle = style.fontStyle ?? "normal";
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

  context.font = `${fontStyle} ${fontWeight} ${fontSize}px ${fontFamily}`;
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
): CanvasTexture {
  const { canvasWidth, canvasHeight } = textureSize(width, height);
  const canvas = document.createElement("canvas");
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Canvas 2D is unavailable for this text hotspot.");
  }
  drawTextHotspot(context, canvasWidth, canvasHeight, text, style);

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.wrapS = ClampToEdgeWrapping;
  texture.wrapT = ClampToEdgeWrapping;
  texture.magFilter = LinearFilter;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}

function useTextTexture(
  text: string,
  width: number,
  height: number,
  style: TextHotspotStyle,
  onLoad: TextHotspotProps["onLoad"],
  onError: TextHotspotProps["onError"],
) {
  const [texture, setTexture] = useState<Texture | null>(null);
  const onLoadRef = useRef(onLoad);
  const onErrorRef = useRef(onError);
  onLoadRef.current = onLoad;
  onErrorRef.current = onError;

  useEffect(() => {
    let nextTexture: CanvasTexture | null = null;
    try {
      nextTexture = createTextTexture(text, width, height, style);
      setTexture(nextTexture);
      onLoadRef.current?.(nextTexture);
    } catch (error) {
      setTexture(null);
      onErrorRef.current?.(error);
    }

    return () => {
      nextTexture?.dispose();
    };
  }, [
    height,
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
  const texture = useTextTexture(text, width, height, style, onLoad, onError);

  return (
    <HotspotAnchor {...anchorProps} height={height} width={width}>
      <HotspotPlane map={texture} opacity={opacity} />
    </HotspotAnchor>
  );
}
