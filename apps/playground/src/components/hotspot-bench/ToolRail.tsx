import { ToolButton } from "../ToolButton";
import type { EditorTool } from "../../types";

type ToolRailProps = {
  tool: EditorTool;
  drawingPolygon: boolean;
  drawingPolyline: boolean;
  hotspotCount: number;
  onSelectTool: (tool: EditorTool, message: string) => void;
  onStartPolygon: () => void;
  onStartPolyline: () => void;
};

export function ToolRail({
  tool,
  drawingPolygon,
  drawingPolyline,
  hotspotCount,
  onSelectTool,
  onStartPolygon,
  onStartPolyline,
}: ToolRailProps) {
  return (
    <aside className="tool-rail" aria-label="Hotspot tools">
      <p className="panel-label">MODE</p>
      <ToolButton
        active={tool === "navigate"}
        detail="Orbit"
        label="Navigate"
        onClick={() => onSelectTool("navigate", "Navigation restored.")}
      />
      <ToolButton
        active={tool === "select"}
        detail="Drag"
        label="Select"
        onClick={() => onSelectTool("select", "Select a hotspot, then drag it in the panorama.")}
      />
      <p className="panel-label">ADD</p>
      <ToolButton
        active={tool === "image"}
        detail="Bitmap"
        label="Image"
        onClick={() => onSelectTool("image", "Click the panorama to place an image hotspot.")}
      />
      <ToolButton
        active={tool === "graphic"}
        detail="Vector"
        label="Graphic"
        onClick={() => onSelectTool("graphic", "Click the panorama to place a graphic hotspot.")}
      />
      <ToolButton
        active={tool === "sequence"}
        detail="Sprite sheet"
        label="Sequence"
        onClick={() => onSelectTool("sequence", "Click the panorama to place a sprite-sheet sequence.")}
      />
      <ToolButton
        active={tool === "video"}
        detail="WebM"
        label="Video"
        onClick={() => onSelectTool("video", "Click the panorama to place a video hotspot.")}
      />
      <ToolButton
        active={drawingPolygon}
        detail="Draw + edit"
        label="Polygon"
        onClick={onStartPolygon}
      />
      <ToolButton
        active={drawingPolyline}
        detail="Draw + edit"
        label="Polyline"
        onClick={onStartPolyline}
      />
      <div className="tool-rail-footer">
        <span>{hotspotCount}</span>
        <small>HOTSPOTS</small>
      </div>
    </aside>
  );
}
