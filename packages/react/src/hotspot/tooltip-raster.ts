import type { CSSProperties } from "react";
import { tooltipBaseline, tooltipLines } from "./tooltip-layout";

function pixels(value: string, fallback = 0) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function readTooltipStyles(parent: HTMLElement, style: CSSProperties) {
  const box = document.createElement("div");
  const text = document.createElement("p");
  const image = document.createElement("img");
  box.className = "pano-hotspot-tooltip";
  text.className = "pano-hotspot-tooltip-text";
  image.className = "pano-hotspot-tooltip-image";
  Object.assign(box.style, style, {
    position: "absolute", visibility: "hidden", pointerEvents: "none",
  });
  Object.assign(text.style, { lineHeight: "inherit", letterSpacing: "inherit", fontFamily: "inherit" });
  box.append(text, image);
  parent.appendChild(box);
  try {
    const bubble = getComputedStyle(box);
    const label = getComputedStyle(text);
    const picture = getComputedStyle(image);
    return {
      background: bubble.backgroundColor,
      color: label.color,
      border: bubble.borderTopColor,
      borderWidth: pixels(bubble.borderTopWidth),
      radius: bubble.borderTopLeftRadius,
      shadow: bubble.boxShadow,
      padding: [bubble.paddingTop, bubble.paddingRight, bubble.paddingBottom, bubble.paddingLeft].map(value => pixels(value)),
      gap: pixels(bubble.columnGap, 8),
      font: `${label.fontStyle} ${label.fontWeight} ${label.fontSize} ${label.fontFamily}`,
      fontSize: pixels(label.fontSize, 12),
      lineHeight: pixels(label.lineHeight, pixels(label.fontSize, 12) * 1.4),
      letterSpacing: pixels(label.letterSpacing),
      imageWidth: pixels(picture.maxWidth, 220),
      imageHeight: pixels(picture.maxHeight, 120),
      imageRadius: picture.borderTopLeftRadius,
    };
  } finally {
    box.remove();
  }
}

function radiusInPixels(value: string, width: number, height: number) {
  const [horizontal, vertical = horizontal] = value.split(/\s+/);
  const resolve = (part: string | undefined, size: number) =>
    part?.endsWith("%") ? pixels(part) * size / 100 : pixels(part ?? "");
  return { x: resolve(horizontal, width), y: resolve(vertical, height) };
}

function readShadows(value: string) {
  return value.split(/,(?![^()]*\))/).flatMap(shadow => {
    const [color] = shadow.match(/(?:rgba?|hsla?|color)\([^)]*\)/) ?? [];
    if (!color || shadow.includes("inset")) return [];
    const [x = 0, y = 0, blur = 0, spread = 0] = shadow.replace(color, "").trim().split(/\s+/).map(value => pixels(value));
    return [{ color, x, y, blur, spread }];
  });
}

export function rasterizeTooltip(
  parent: HTMLElement,
  style: CSSProperties,
  text: string,
  image: HTMLImageElement | null,
  availableWidth: number,
  rasterScale: number,
  maxTextureSize: number,
) {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx || (!text && !image)) return null;
  const paint = readTooltipStyles(parent, style);
  const [pt = 0, pr = 0, pb = 0, pl = 0] = paint.padding;
  const border = paint.borderWidth;
  const innerWidth = Math.max(1, availableWidth - pl - pr - 2 * border);
  const gap = image && text ? Math.min(paint.gap, innerWidth / 4) : 0;

  const setFont = () => {
    ctx.font = paint.font;
    ctx.textBaseline = "alphabetic";
    if ("letterSpacing" in ctx) ctx.letterSpacing = `${paint.letterSpacing}px`;
  };
  setFont();
  const measure = (value: string) => ctx.measureText(value).width;
  const textReserve = Math.min(innerWidth / 2, measure(text.replace(/\s+/g, " ")));
  const imageLimit = innerWidth - gap - textReserve;
  const imageScale = image ? Math.min(1, imageLimit / image.naturalWidth, paint.imageWidth / image.naturalWidth,
    paint.imageHeight / image.naturalHeight) : 0;
  const imageWidth = image ? image.naturalWidth * imageScale : 0;
  const imageHeight = image ? image.naturalHeight * imageScale : 0;
  const lines = tooltipLines(text, Math.max(1, innerWidth - imageWidth - gap), measure);
  const textWidth = lines.reduce((max, line) => Math.max(max, measure(line)), 0);
  const width = Math.max(1, imageWidth + gap + textWidth + pl + pr + border * 2);
  const height = Math.max(1, Math.max(imageHeight, lines.length * paint.lineHeight) + pt + pb + border * 2);
  const shadows = readShadows(paint.shadow);
  // Symmetric padding keeps the visible bubble centered in the texture.
  const gutter = Math.ceil(Math.max(2, ...shadows.map(({ x, y, blur, spread }) =>
    Math.max(Math.abs(x), Math.abs(y)) + 2 * blur + Math.max(0, spread))));
  const resolution = Math.min(rasterScale, maxTextureSize / (Math.max(width, height) + 2 * gutter));
  canvas.width = Math.min(maxTextureSize, Math.ceil((width + 2 * gutter) * resolution));
  canvas.height = Math.min(maxTextureSize, Math.ceil((height + 2 * gutter) * resolution));
  const textureWidth = canvas.width / resolution;
  const textureHeight = canvas.height / resolution;
  ctx.scale(resolution, resolution);
  ctx.translate((textureWidth - width) / 2, (textureHeight - height) / 2);
  const radius = radiusInPixels(paint.radius, width, height);
  const path = (inset: number) => {
    ctx.beginPath();
    ctx.roundRect(inset, inset, Math.max(0, width - 2 * inset), Math.max(0, height - 2 * inset), {
      x: Math.max(0, radius.x - inset), y: Math.max(0, radius.y - inset),
    });
  };
  for (const shadow of shadows.reverse()) {
    ctx.save();
    ctx.shadowColor = shadow.color;
    ctx.shadowBlur = shadow.blur * resolution;
    ctx.shadowOffsetX = shadow.x * resolution;
    ctx.shadowOffsetY = shadow.y * resolution;
    path(-shadow.spread);
    ctx.fill();
    ctx.restore();
  }
  path(0);
  ctx.globalCompositeOperation = "destination-out";
  ctx.fill();
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = paint.background;
  ctx.fill();
  if (border > 0) {
    path(border / 2);
    ctx.strokeStyle = paint.border;
    ctx.lineWidth = border;
    ctx.stroke();
  }
  const left = pl + border;
  const top = pt + border;
  if (image && imageWidth > 0) {
    ctx.save();
    ctx.imageSmoothingQuality = "high";
    ctx.beginPath();
    ctx.roundRect(left, top, imageWidth, imageHeight, radiusInPixels(paint.imageRadius, imageWidth, imageHeight));
    ctx.clip();
    ctx.drawImage(image, left, top, imageWidth, imageHeight);
    ctx.restore();
  }
  setFont();
  ctx.fillStyle = paint.color;
  for (const [index, line] of lines.entries()) {
    const metrics = ctx.measureText(line);
    const y = tooltipBaseline(top + index * paint.lineHeight, paint.lineHeight,
      metrics.fontBoundingBoxAscent ?? paint.fontSize * 0.8, metrics.fontBoundingBoxDescent ?? paint.fontSize * 0.2);
    ctx.fillText(line, left + imageWidth + gap, y);
  }
  return { canvas, width, height, textureWidth, textureHeight, font: paint.font };
}
