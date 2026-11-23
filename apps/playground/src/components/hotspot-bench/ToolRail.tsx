import { usePlaygroundLanguage } from "../../i18n/language";
import { panelLabelClassName } from "../../ui";
import { ToolButton } from "../ToolButton";
import { useShallow } from "zustand/react/shallow";
import {
  selectDrawingPolygon,
  selectDrawingPolyline,
  selectHotspotCount,
  useHotspotBenchStore,
} from "./store";

export function ToolRail() {
  const { t } = usePlaygroundLanguage();
  const {
    tool,
    drawingPolygon,
    drawingPolyline,
    hotspotCount,
    selectTool,
    startPolygon,
    startPolyline,
  } = useHotspotBenchStore(
    useShallow((state) => ({
      tool: state.tool,
      drawingPolygon: selectDrawingPolygon(state),
      drawingPolyline: selectDrawingPolyline(state),
      hotspotCount: selectHotspotCount(state),
      selectTool: state.selectTool,
      startPolygon: state.startPolygon,
      startPolyline: state.startPolyline,
    })),
  );

  return (
    <aside
      aria-label={t("Hotspot tools")}
      className="min-h-full border-r border-[#27454d] bg-[#071316]/70 p-[17px] max-[760px]:grid max-[760px]:min-h-0 max-[760px]:grid-flow-col max-[760px]:auto-cols-[minmax(112px,1fr)] max-[760px]:grid-cols-[repeat(11,minmax(112px,1fr))] max-[760px]:gap-1.5 max-[760px]:overflow-x-auto max-[760px]:border-r-0 max-[760px]:border-b max-[760px]:border-[#27454d] max-[760px]:p-2.5"
    >
      <p className={panelLabelClassName}>{t("MODE")}</p>
      <ToolButton
        active={tool === "navigate"}
        detail={t("Orbit")}
        label={t("Navigate")}
        onClick={() => selectTool("navigate", "Navigation restored.")}
      />
      <ToolButton
        active={tool === "select"}
        detail={t("Drag")}
        label={t("Select")}
        onClick={() => selectTool("select", "Select a hotspot, then drag it in the panorama.")}
      />
      <p className={`mt-4 ${panelLabelClassName} max-[760px]:mt-0`}>{t("ADD")}</p>
      <ToolButton
        active={tool === "image"}
        detail={t("Bitmap")}
        label={t("Image")}
        onClick={() => selectTool("image", "Click the panorama to place an image hotspot.")}
      />
      <ToolButton
        active={tool === "graphic"}
        detail={t("Vector")}
        label={t("Graphic")}
        onClick={() => selectTool("graphic", "Click the panorama to place a graphic hotspot.")}
      />
      <ToolButton
        active={tool === "sequence"}
        detail={t("Sprite sheet")}
        label={t("Sequence")}
        onClick={() => selectTool("sequence", "Click the panorama to place a sprite-sheet sequence.")}
      />
      <ToolButton
        active={tool === "video"}
        detail="WebM"
        label={t("Video")}
        onClick={() => selectTool("video", "Click the panorama to place a video hotspot.")}
      />
      <ToolButton
        active={tool === "audio"}
        detail="MP3"
        label={t("Audio")}
        onClick={() => selectTool("audio", "Click the panorama to place a directional audio hotspot.")}
      />
      <ToolButton
        active={tool === "text"}
        detail={t("Caption")}
        label={t("Text")}
        onClick={() => selectTool("text", "Click the panorama to place a text hotspot.")}
      />
      <ToolButton
        active={tool === "iframe"}
        detail={t("Embed")}
        label={t("Iframe")}
        onClick={() => selectTool("iframe", "Click the panorama to place an iframe hotspot.")}
      />
      <ToolButton
        active={drawingPolygon}
        detail={t("Draw + edit")}
        label={t("Polygon")}
        onClick={startPolygon}
      />
      <ToolButton
        active={drawingPolyline}
        detail={t("Draw + edit")}
        label={t("Polyline")}
        onClick={startPolyline}
      />
      <div className="mt-5 grid gap-1 max-[760px]:hidden">
        <span className="font-mono text-[1.1rem] text-[#dbeef0]">{hotspotCount}</span>
        <small className="font-mono text-[0.58rem] tracking-[0.1em] text-[#739097]">{t("HOTSPOTS")}</small>
      </div>
    </aside>
  );
}
