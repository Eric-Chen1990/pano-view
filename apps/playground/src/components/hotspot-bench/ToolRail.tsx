import { ToolButton } from "../ToolButton";
import { useShallow } from "zustand/react/shallow";
import {
  selectDrawingPolygon,
  selectDrawingPolyline,
  selectHotspotCount,
  useHotspotBenchStore,
} from "./store";

export function ToolRail() {
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
    <aside className="tool-rail" aria-label="Hotspot tools">
      <p className="panel-label">MODE</p>
      <ToolButton
        active={tool === "navigate"}
        detail="Orbit"
        label="Navigate"
        onClick={() => selectTool("navigate", "Navigation restored.")}
      />
      <ToolButton
        active={tool === "select"}
        detail="Drag"
        label="Select"
        onClick={() => selectTool("select", "Select a hotspot, then drag it in the panorama.")}
      />
      <p className="panel-label">ADD</p>
      <ToolButton
        active={tool === "image"}
        detail="Bitmap"
        label="Image"
        onClick={() => selectTool("image", "Click the panorama to place an image hotspot.")}
      />
      <ToolButton
        active={tool === "graphic"}
        detail="Vector"
        label="Graphic"
        onClick={() => selectTool("graphic", "Click the panorama to place a graphic hotspot.")}
      />
      <ToolButton
        active={tool === "sequence"}
        detail="Sprite sheet"
        label="Sequence"
        onClick={() => selectTool("sequence", "Click the panorama to place a sprite-sheet sequence.")}
      />
      <ToolButton
        active={tool === "video"}
        detail="WebM"
        label="Video"
        onClick={() => selectTool("video", "Click the panorama to place a video hotspot.")}
      />
      <ToolButton
        active={tool === "text"}
        detail="Caption"
        label="Text"
        onClick={() => selectTool("text", "Click the panorama to place a text hotspot.")}
      />
      <ToolButton
        active={tool === "iframe"}
        detail="Embed"
        label="Iframe"
        onClick={() => selectTool("iframe", "Click the panorama to place an iframe hotspot.")}
      />
      <ToolButton
        active={drawingPolygon}
        detail="Draw + edit"
        label="Polygon"
        onClick={startPolygon}
      />
      <ToolButton
        active={drawingPolyline}
        detail="Draw + edit"
        label="Polyline"
        onClick={startPolyline}
      />
      <div className="tool-rail-footer">
        <span>{hotspotCount}</span>
        <small>HOTSPOTS</small>
      </div>
    </aside>
  );
}
