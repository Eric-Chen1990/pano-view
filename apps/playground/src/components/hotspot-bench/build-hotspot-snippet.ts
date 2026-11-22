import type {
  EditorHotspot,
  EditorPolygon,
  EditorPolyline,
} from "../../types";

function wrapSnippet(
  component: string,
  type: EditorHotspot["type"] | "polygon" | "polyline",
  { ariaLabel, ...props }: { ariaLabel: string } & Record<string, unknown>,
) {
  const propLines = Object.entries({ ariaLabel, ...props })
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => {
      const literal = JSON.stringify(value);
      // Quoted JSX attributes decode entities and do not support JavaScript escapes.
      const plainString = typeof value === "string"
        && literal === `"${value}"`
        && !/[&<>\u2028\u2029]/u.test(value);
      return `        ${key}=${plainString ? literal : `{${literal}}`}`;
    })
    .join("\n");
  const code = `import { ${component}, PanoViewer, Sphere } from "@ericchen1990/pano-view";
import "@ericchen1990/pano-view/styles.css";

export function PanoramaHotspot() {
  return (
    <PanoViewer style={{ height: 560 }}>
      <Sphere src="/fixtures/panorama/panos/1/sphere.webp" previewUrl="preview.webp" />
      <${component}
${propLines}
      />
    </PanoViewer>
  );
}`;
  return {
    label: component,
    blurb: "Generated from the selected hotspot’s settings.",
    code,
    value: { type, label: ariaLabel, ...props },
  };
}

function pointBaseProps(hotspot: EditorHotspot) {
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
    tooltipMode: hotspot.tooltipMode,
    tooltipScaleMode: hotspot.tooltipScaleMode,
    tooltipAppearance: hotspot.tooltipAppearance,
  };
}

function buildPointHotspotSnippet(hotspot: EditorHotspot) {
  const base = pointBaseProps(hotspot);
  switch (hotspot.type) {
    case "image":
      return wrapSnippet("ImageHotspot", "image", {
        ...base,
        src: hotspot.src,
      });
    case "graphic":
      return wrapSnippet("GraphicHotspot", "graphic", {
        ...base,
        graphic: hotspot.graphic,
      });
    case "sequence":
      return wrapSnippet("SequenceHotspot", "sequence", {
        ...base,
        src: hotspot.src,
        frameCount: hotspot.frameCount,
        frameDirection: hotspot.frameDirection,
        fps: hotspot.fps,
        loop: hotspot.loop,
        playing: hotspot.playing,
      });
    case "video":
      return wrapSnippet("VideoHotspot", "video", {
        ...base,
        src: hotspot.src,
        poster: hotspot.poster || undefined,
        playing: hotspot.playing,
        loop: hotspot.loop,
        muted: hotspot.muted,
        volume: hotspot.volume,
      });
    case "audio":
      return wrapSnippet("AudioHotspot", "audio", {
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
      return wrapSnippet("TextHotspot", "text", {
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
      return wrapSnippet("IframeHotspot", "iframe", {
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

function buildPolygonSnippet(polygon: EditorPolygon) {
  return wrapSnippet("PolygonHotspot", "polygon", {
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
    tooltipMode: polygon.tooltipMode,
    tooltipScaleMode: polygon.tooltipScaleMode,
    tooltipAppearance: polygon.tooltipAppearance,
  });
}

function buildPolylineSnippet(polyline: EditorPolyline) {
  return wrapSnippet("PolylineHotspot", "polyline", {
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
    tooltipMode: polyline.tooltipMode,
    tooltipScaleMode: polyline.tooltipScaleMode,
    tooltipAppearance: polyline.tooltipAppearance,
  });
}

export function buildHotspotBenchSnippet(args: {
  selectedId: string | null;
  hotspots: EditorHotspot[];
  polygons: EditorPolygon[];
  polylines: EditorPolyline[];
}) {
  const { selectedId, hotspots, polygons, polylines } = args;
  const hotspot = hotspots.find(({ id }) => id === selectedId);
  const missingSource = hotspot && "src" in hotspot && !hotspot.src.trim();
  if (hotspot && !missingSource) return buildPointHotspotSnippet(hotspot);
  const polygon = polygons.find(({ id }) => id === selectedId);
  if (polygon) return buildPolygonSnippet(polygon);
  const polyline = polylines.find(({ id }) => id === selectedId);
  if (polyline) return buildPolylineSnippet(polyline);

  return {
    ...wrapSnippet("GraphicHotspot", "graphic", {
      id: "marker",
      ariaLabel: "Panorama marker",
      position: { yaw: 0, pitch: 0 },
      width: 8,
      height: 8,
      graphic: { kind: "circle", fill: "#df6b42" },
    }),
    blurb: missingSource
      ? "Set a media source to see the selected hotspot’s code. This marker is a starter example."
      : "Select a hotspot to see its current settings. Start with this marker if no hotspot is selected.",
  };
}
