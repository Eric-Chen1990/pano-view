import type {
  EditorHotspot,
  EditorPolygon,
  EditorPolyline,
} from "../../types";

const EMPTY_SNIPPET = `// Choose a hotspot tool, then click the panorama to place it.
// Select an existing hotspot, polygon, or polyline to see its component JSX here.

import {
  ImageHotspot,
  GraphicHotspot,
  SequenceHotspot,
  VideoHotspot,
  AudioHotspot,
  TextHotspot,
  IframeHotspot,
  PolygonHotspot,
  PolylineHotspot,
  PanoViewer,
  Sphere,
} from "@ericchen1990/pano-view";

<PanoViewer style={{ height: 560 }}>
  <Sphere src="/fixtures/panorama/panos/1/sphere.webp" previewUrl="preview.webp" />
  {/* Place a hotspot, then select it */}
</PanoViewer>`;

function indentLines(value: string, spaces: number): string {
  const pad = " ".repeat(spaces);
  return value
    .split("\n")
    .map((line) => (line.length ? `${pad}${line}` : line))
    .join("\n");
}

function formatLiteral(value: unknown, depth = 0): string {
  if (typeof value === "string") {
    return JSON.stringify(value);
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (value === null) {
    return "null";
  }
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return "[]";
    }
    const items = value.map((entry) => formatLiteral(entry, depth + 1));
    const compact = items.every((item) => !item.includes("\n") && item.length < 40);
    if (compact) {
      return `[${items.join(", ")}]`;
    }
    return `[\n${items.map((item) => indentLines(item, 2)).join(",\n")}\n]`;
  }
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).filter(
      ([, entry]) => entry !== undefined,
    );
    if (entries.length === 0) {
      return "{}";
    }
    const lines = entries.map(([key, entry]) => {
      const rendered = formatLiteral(entry, depth + 1);
      if (rendered.includes("\n")) {
        return `${key}: ${rendered.split("\n").join(`\n${" ".repeat(2)}`)}`;
      }
      return `${key}: ${rendered}`;
    });
    return `{\n${lines.map((line) => indentLines(line, 2)).join(",\n")}\n}`;
  }
  return "undefined";
}

function propLines(props: Record<string, unknown>): string {
  return Object.entries(props)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => {
      if (typeof value === "string") {
        return `  ${key}=${JSON.stringify(value)}`;
      }
      if (typeof value === "boolean") {
        return value ? `  ${key}` : `  ${key}={false}`;
      }
      if (typeof value === "number") {
        return `  ${key}={${value}}`;
      }
      const literal = formatLiteral(value);
      if (!literal.includes("\n")) {
        return `  ${key}={${literal}}`;
      }
      return `  ${key}={${literal.split("\n").join("\n  ")}}`;
    })
    .join("\n");
}

function wrapSnippet(componentName: string, importName: string, props: Record<string, unknown>): string {
  return `import { ${importName}, PanoViewer, Sphere } from "@ericchen1990/pano-view";

<PanoViewer style={{ height: 560 }}>
  <Sphere src="/fixtures/panorama/panos/1/sphere.webp" previewUrl="preview.webp" />
  <${componentName}
${propLines(props)}
  />
</PanoViewer>`;
}

function pointBaseProps(hotspot: EditorHotspot): Record<string, unknown> {
  return {
    id: hotspot.id,
    ariaLabel: hotspot.label,
    position: hotspot.position,
    width: hotspot.width,
    height: hotspot.height,
    rotation: hotspot.rotation || undefined,
    scale: hotspot.scale === 1 ? undefined : hotspot.scale,
    mode: hotspot.mode,
    distance: hotspot.distance,
    scaleMode: hotspot.scaleMode,
    opacity: hotspot.opacity === 1 ? undefined : hotspot.opacity,
    visible: hotspot.visible ? undefined : false,
    pointerEvents: hotspot.pointerEvents === "auto" ? undefined : hotspot.pointerEvents,
    tooltip: hotspot.tooltip,
    tooltipTrigger: hotspot.tooltipTrigger,
    tooltipPlacement: hotspot.tooltipPlacement,
    tooltipOffset: hotspot.tooltipOffset,
    tooltipAppearance: hotspot.tooltipAppearance,
  };
}

function buildPointHotspotSnippet(hotspot: EditorHotspot): string {
  const base = pointBaseProps(hotspot);
  switch (hotspot.type) {
    case "image":
      return wrapSnippet("ImageHotspot", "ImageHotspot", {
        ...base,
        src: hotspot.src,
      });
    case "graphic":
      return wrapSnippet("GraphicHotspot", "GraphicHotspot", {
        ...base,
        graphic: hotspot.graphic,
      });
    case "sequence":
      return wrapSnippet("SequenceHotspot", "SequenceHotspot", {
        ...base,
        src: hotspot.src,
        frameCount: hotspot.frameCount,
        frameDirection: hotspot.frameDirection,
        fps: hotspot.fps,
        loop: hotspot.loop,
        playing: hotspot.playing,
      });
    case "video":
      return wrapSnippet("VideoHotspot", "VideoHotspot", {
        ...base,
        src: hotspot.src,
        poster: hotspot.poster || undefined,
        playing: hotspot.playing,
        loop: hotspot.loop,
        muted: hotspot.muted,
        volume: hotspot.volume,
      });
    case "audio":
      return wrapSnippet("AudioHotspot", "AudioHotspot", {
        ...base,
        src: hotspot.src,
        playing: hotspot.playing,
        loop: hotspot.loop,
        muted: hotspot.muted,
        volume: hotspot.volume,
        pauseWhenHidden: hotspot.pauseWhenHidden,
        range: hotspot.range,
        icon: hotspot.icon || undefined,
        playingIcon: hotspot.playingIcon || undefined,
        marker: hotspot.marker,
      });
    case "text":
      return wrapSnippet("TextHotspot", "TextHotspot", {
        ...base,
        text: hotspot.text,
        fontFamily: hotspot.fontFamily,
        fontSize: hotspot.fontSize,
        fontWeight: hotspot.fontWeight,
        fontStyle: hotspot.fontStyle,
        color: hotspot.color,
        background: hotspot.background,
        backgroundOpacity: hotspot.backgroundOpacity,
        align: hotspot.align,
        verticalAlign: hotspot.verticalAlign,
        whiteSpace: hotspot.whiteSpace,
      });
    case "iframe":
      return wrapSnippet("IframeHotspot", "IframeHotspot", {
        ...base,
        src: hotspot.src,
        title: hotspot.title,
        sandbox: hotspot.sandbox,
        pointerPolicy: hotspot.pointerPolicy,
      });
    default: {
      const exhaustive: never = hotspot;
      return exhaustive;
    }
  }
}

function buildPolygonSnippet(polygon: EditorPolygon): string {
  return wrapSnippet("PolygonHotspot", "PolygonHotspot", {
    id: polygon.id,
    ariaLabel: polygon.label,
    vertices: polygon.vertices,
    fill: polygon.fill,
    fillOpacity: polygon.fillOpacity,
    stroke: polygon.stroke,
    strokeWidth: polygon.strokeWidth,
    strokeOpacity: polygon.strokeOpacity,
    strokeDashSize: polygon.strokeDashSize || undefined,
    strokeGapSize: polygon.strokeGapSize || undefined,
    visible: polygon.visible ? undefined : false,
    pointerEvents: polygon.pointerEvents === "auto" ? undefined : polygon.pointerEvents,
    tooltip: polygon.tooltip,
    tooltipTrigger: polygon.tooltipTrigger,
    tooltipPlacement: polygon.tooltipPlacement,
    tooltipOffset: polygon.tooltipOffset,
    tooltipAppearance: polygon.tooltipAppearance,
  });
}

function buildPolylineSnippet(polyline: EditorPolyline): string {
  return wrapSnippet("PolylineHotspot", "PolylineHotspot", {
    id: polyline.id,
    ariaLabel: polyline.label,
    vertices: polyline.vertices,
    stroke: polyline.stroke,
    strokeWidth: polyline.strokeWidth,
    strokeOpacity: polyline.strokeOpacity,
    strokeDashSize: polyline.strokeDashSize || undefined,
    strokeGapSize: polyline.strokeGapSize || undefined,
    visible: polyline.visible ? undefined : false,
    pointerEvents: polyline.pointerEvents === "auto" ? undefined : polyline.pointerEvents,
    tooltip: polyline.tooltip,
    tooltipTrigger: polyline.tooltipTrigger,
    tooltipPlacement: polyline.tooltipPlacement,
    tooltipOffset: polyline.tooltipOffset,
    tooltipAppearance: polyline.tooltipAppearance,
  });
}

export function buildHotspotBenchSnippet(args: {
  selectedId: string | null;
  hotspots: EditorHotspot[];
  polygons: EditorPolygon[];
  polylines: EditorPolyline[];
}): { label: string; blurb: string; code: string } {
  const { selectedId, hotspots, polygons, polylines } = args;
  if (!selectedId) {
    return {
      label: "Hotspot component",
      blurb: "Select a hotspot, polygon, or polyline to generate pasteable component JSX.",
      code: EMPTY_SNIPPET,
    };
  }

  const hotspot = hotspots.find((entry) => entry.id === selectedId);
  if (hotspot) {
    return {
      label: `${hotspot.type} hotspot`,
      blurb: `Generated from the selected ${hotspot.type} hotspot. Drag and editor callbacks are omitted.`,
      code: buildPointHotspotSnippet(hotspot),
    };
  }

  const polygon = polygons.find((entry) => entry.id === selectedId);
  if (polygon) {
    return {
      label: "Polygon hotspot",
      blurb: "Generated from the selected polygon. Drag and vertex-edit callbacks are omitted.",
      code: buildPolygonSnippet(polygon),
    };
  }

  const polyline = polylines.find((entry) => entry.id === selectedId);
  if (polyline) {
    return {
      label: "Polyline hotspot",
      blurb: "Generated from the selected polyline. Drag and vertex-edit callbacks are omitted.",
      code: buildPolylineSnippet(polyline),
    };
  }

  return {
    label: "Hotspot component",
    blurb: "Select a hotspot, polygon, or polyline to generate pasteable component JSX.",
    code: EMPTY_SNIPPET,
  };
}
