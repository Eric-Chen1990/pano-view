import { cssFontFamily } from "../css-font-family";
import {
  DEFAULT_CALLOUT_RASTER_FONT_FAMILY,
  calloutTitleBodyGap,
  calloutTitlePaddingY,
  type CalloutContent,
} from "./callout-layout";

export type CalloutRasterStyle = {
  width: number;
  background: string;
  color: string;
  titleBackground: string;
  titleColor: string;
  accentColor: string;
  fontSize: number;
  titleFontSize: number;
  fontFamily?: string;
  padding: number;
  borderRadius: number;
  accentWidth: number;
  accentOnLeft: boolean;
};

export type CalloutRasterResult = {
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
  textureWidth: number;
  textureHeight: number;
  font: string;
};

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
    } else {
      if (current) lines.push(current);
      if (context.measureText(word).width <= maxWidth) {
        current = word;
        continue;
      }
      let chunk = "";
      for (const character of word) {
        const next = chunk + character;
        if (context.measureText(next).width <= maxWidth || chunk === "") {
          chunk = next;
        } else {
          lines.push(chunk);
          chunk = character;
        }
      }
      current = chunk;
    }
  }
  if (current) lines.push(current);
  return lines.length > 0 ? lines : [""];
}

function wrapText(
  context: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  return text.split("\n").flatMap((paragraph) => wrapLine(context, paragraph, maxWidth));
}

/** Rasterize a callout card (accent + title/body/image) for VR meshes. */
export function rasterizeCallout(
  content: CalloutContent,
  style: CalloutRasterStyle,
  image: HTMLImageElement | null,
  rasterScale: number,
  maxTextureSize: number,
): CalloutRasterResult | null {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const title = content.title?.trim() ?? "";
  const text = content.text?.trim() ?? "";
  if (!title && !text && !image) return null;

  const padding = Math.max(0, style.padding);
  const accent = Math.max(1, style.accentWidth);
  const family = cssFontFamily(
    style.fontFamily?.trim() || DEFAULT_CALLOUT_RASTER_FONT_FAMILY,
  );
  const bodyFontSize = style.fontSize;
  const titleFontSize = style.titleFontSize;
  const font = `600 ${bodyFontSize}px ${family}`;
  const titleFont = `700 ${titleFontSize}px ${family}`;
  const bodyLineHeight = bodyFontSize * 1.45;
  const titleLineHeight = titleFontSize * 1.25;
  const titlePadY = calloutTitlePaddingY(padding);
  const titleBodyGap = calloutTitleBodyGap(padding);
  const contentWidth = Math.max(40, style.width);

  ctx.font = titleFont;
  const titleHeight = title ? titleLineHeight + titlePadY * 2 : 0;
  ctx.font = font;
  const imageMaxWidth = contentWidth - padding * 2;
  const imageMaxHeight = 120;
  let imageWidth = 0;
  let imageHeight = 0;
  if (image && image.naturalWidth > 0) {
    const scale = Math.min(
      1,
      imageMaxWidth / image.naturalWidth,
      imageMaxHeight / image.naturalHeight,
    );
    imageWidth = image.naturalWidth * scale;
    imageHeight = image.naturalHeight * scale;
  }
  const textLines = text
    ? wrapText(ctx, text, Math.max(1, contentWidth - padding * 2))
    : [];
  const textBlock = textLines.length * bodyLineHeight;
  const bodyHeight =
    (imageHeight > 0 ? imageHeight + (textLines.length ? padding / 2 : 0) : 0) +
    textBlock;
  const hasBody = bodyHeight > 0;
  const height = Math.max(
    titleHeight || bodyLineHeight + padding * 2,
    (title ? titleHeight : 0) +
      (hasBody
        ? (title ? titleBodyGap : padding) + bodyHeight + padding
        : title
          ? 0
          : padding * 2),
  );
  const width = accent + contentWidth;
  const gutter = 2;
  const resolution = Math.min(
    rasterScale,
    maxTextureSize / (Math.max(width, height) + 2 * gutter),
  );
  canvas.width = Math.min(
    maxTextureSize,
    Math.ceil((width + 2 * gutter) * resolution),
  );
  canvas.height = Math.min(
    maxTextureSize,
    Math.ceil((height + 2 * gutter) * resolution),
  );
  const textureWidth = canvas.width / resolution;
  const textureHeight = canvas.height / resolution;
  ctx.setTransform(resolution, 0, 0, resolution, 0, 0);
  ctx.clearRect(0, 0, textureWidth, textureHeight);
  ctx.translate((textureWidth - width) / 2, (textureHeight - height) / 2);

  const cardX = style.accentOnLeft ? accent : 0;
  const accentX = style.accentOnLeft ? 0 : contentWidth;

  if (style.background && style.background !== "transparent") {
    ctx.fillStyle = style.background;
    ctx.beginPath();
    ctx.roundRect(cardX, 0, contentWidth, height, style.borderRadius);
    ctx.fill();
  }

  ctx.fillStyle = style.accentColor;
  ctx.fillRect(accentX, 0, accent, height);

  let y = 0;
  if (title) {
    ctx.fillStyle = style.titleBackground;
    ctx.fillRect(cardX, 0, contentWidth, titleHeight);
    ctx.fillStyle = style.titleColor;
    ctx.font = titleFont;
    ctx.textBaseline = "middle";
    ctx.fillText(title, cardX + padding, titleHeight / 2);
    y = titleHeight;
  }

  y += title ? (hasBody ? titleBodyGap : 0) : padding;
  if (image && imageWidth > 0) {
    ctx.drawImage(image, cardX + padding, y, imageWidth, imageHeight);
    y += imageHeight + (textLines.length ? padding / 2 : 0);
  }
  if (textLines.length) {
    ctx.fillStyle = style.color;
    ctx.font = font;
    ctx.textBaseline = "top";
    for (const [index, line] of textLines.entries()) {
      ctx.fillText(line, cardX + padding, y + index * bodyLineHeight);
    }
  }

  return {
    canvas,
    width,
    height,
    textureWidth,
    textureHeight,
    font,
  };
}
