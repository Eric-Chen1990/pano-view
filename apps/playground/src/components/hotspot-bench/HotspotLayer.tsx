import {
  GraphicHotspot,
  ImageHotspot,
  PolygonHotspot,
  PolylineHotspot,
  SequenceHotspot,
  VideoHotspot,
  validatePolygonVertices,
  type HotspotPosition,
} from "@ericchen1990/pano-view";
import type { EditorHotspot, EditorPolygon, EditorPolyline, EditorTool } from "../../types";
import { formatPosition, polygonIssueSummary } from "../../utils";

type HotspotLayerProps = {
  tool: EditorTool;
  drawingPath: boolean;
  drawingPolygon: boolean;
  draftVertices: HotspotPosition[];
  draftIssues: ReturnType<typeof validatePolygonVertices>;
  draftPolygonFilled: boolean;
  hotspots: EditorHotspot[];
  polygons: EditorPolygon[];
  polylines: EditorPolyline[];
  selectedPolygon: EditorPolygon | null;
  selectedPolyline: EditorPolyline | null;
  onSelectItem: (id: string) => void;
  onUpdateHotspot: (
    id: string,
    patch: Partial<Omit<EditorHotspot, "id" | "type" | "graphic">>,
  ) => void;
  onUpdateSequence: (
    id: string,
    patch: Partial<Omit<Extract<EditorHotspot, { type: "sequence" }>, "id" | "type">>,
  ) => void;
  onUpdateVideo: (
    id: string,
    patch: Partial<Omit<Extract<EditorHotspot, { type: "video" }>, "id" | "type">>,
  ) => void;
  onUpdatePolygon: (id: string, patch: Partial<Omit<EditorPolygon, "id">>) => void;
  onUpdatePolyline: (id: string, patch: Partial<Omit<EditorPolyline, "id">>) => void;
  onStatus: (message: string) => void;
};

export function HotspotLayer({
  tool,
  drawingPath,
  drawingPolygon,
  draftVertices,
  draftIssues,
  draftPolygonFilled,
  hotspots,
  polygons,
  polylines,
  selectedPolygon,
  selectedPolyline,
  onSelectItem,
  onUpdateHotspot,
  onUpdateSequence,
  onUpdateVideo,
  onUpdatePolygon,
  onUpdatePolyline,
  onStatus,
}: HotspotLayerProps) {
  return (
    <>
      {hotspots.map((hotspot) => {
        const sharedProps = {
          ariaLabel: hotspot.label,
          draggable: tool === "select",
          id: hotspot.id,
          opacity: hotspot.opacity,
          mode: hotspot.mode,
          distance: hotspot.distance,
          interactive: !drawingPath,
          position: hotspot.position,
          rotation: hotspot.rotation,
          scale: hotspot.scale,
          scaleMode: hotspot.scaleMode,
          visible: hotspot.visible,
          width: hotspot.width,
          height: hotspot.height,
          onClick: () => {
            onSelectItem(hotspot.id);
            if (hotspot.type === "sequence") {
              onUpdateSequence(hotspot.id, { playing: !hotspot.playing });
            }
            if (hotspot.type === "video") {
              onUpdateVideo(hotspot.id, { playing: !hotspot.playing });
            }
            onStatus(`${hotspot.label} selected.`);
          },
          onDragStart: () => {
            onSelectItem(hotspot.id);
            onStatus(`Dragging ${hotspot.label}.`);
          },
          onPositionChange: ({ position }: { position: HotspotPosition }) => {
            onUpdateHotspot(hotspot.id, { position });
          },
          onDragEnd: ({ position }: { position: HotspotPosition }) => {
            onStatus(`${hotspot.label} moved to ${formatPosition(position)}.`);
          },
        };

        if (hotspot.type === "image") {
          return <ImageHotspot key={hotspot.id} {...sharedProps} src={hotspot.src} />;
        }
        if (hotspot.type === "graphic") {
          return (
            <GraphicHotspot
              key={hotspot.id}
              {...sharedProps}
              graphic={hotspot.graphic}
            />
          );
        }
        if (hotspot.type === "sequence") {
          return (
            <SequenceHotspot
              key={hotspot.id}
              {...sharedProps}
              frameCount={hotspot.frameCount}
              frameDirection={hotspot.frameDirection}
              fps={hotspot.fps}
              loop={hotspot.loop}
              playing={hotspot.playing}
              src={hotspot.src}
              onEnded={() => onUpdateSequence(hotspot.id, { playing: false })}
            />
          );
        }
        return (
          <VideoHotspot
            key={hotspot.id}
            {...sharedProps}
            loop={hotspot.loop}
            muted={hotspot.muted}
            onEnded={() => onUpdateVideo(hotspot.id, { playing: false })}
            playing={hotspot.playing}
            poster={hotspot.poster}
            src={hotspot.src}
            volume={hotspot.volume}
          />
        );
      })}
      {polygons.map((polygon) => (
        <PolygonHotspot
          key={polygon.id}
          ariaLabel={polygon.label}
          draggable={tool === "select"}
          fill={polygon.fill}
          fillOpacity={polygon.fillOpacity}
          id={polygon.id}
          interactive={!drawingPath}
          onClick={() => {
            onSelectItem(polygon.id);
            onStatus(`${polygon.label} selected.`);
          }}
          onDragEnd={({ vertices }) => {
            const issues = validatePolygonVertices(vertices);
            if (issues.length === 0) {
              onUpdatePolygon(polygon.id, { vertices });
              onStatus(`${polygon.label} moved.`);
            } else {
              onStatus(`Polygon move rejected: ${polygonIssueSummary(issues)}`);
            }
          }}
          onDragStart={() => {
            onSelectItem(polygon.id);
            onStatus(`Dragging ${polygon.label}.`);
          }}
          onVerticesChange={({ vertices }) => {
            if (validatePolygonVertices(vertices).length === 0) {
              onUpdatePolygon(polygon.id, { vertices });
            }
          }}
          stroke={polygon.stroke}
          strokeOpacity={polygon.strokeOpacity}
          strokeWidth={polygon.strokeWidth}
          vertices={polygon.vertices}
          visible={polygon.visible}
        />
      ))}
      {polylines.map((polyline) => (
        <PolylineHotspot
          key={polyline.id}
          ariaLabel={polyline.label}
          draggable={tool === "select"}
          id={polyline.id}
          interactive={!drawingPath}
          onClick={() => {
            onSelectItem(polyline.id);
            onStatus(`${polyline.label} selected.`);
          }}
          onDragEnd={({ vertices }) => {
            onUpdatePolyline(polyline.id, { vertices });
            onStatus(`${polyline.label} moved.`);
          }}
          onDragStart={() => {
            onSelectItem(polyline.id);
            onStatus(`Dragging ${polyline.label}.`);
          }}
          onVerticesChange={({ vertices }) => onUpdatePolyline(polyline.id, { vertices })}
          stroke={polyline.stroke}
          strokeOpacity={polyline.strokeOpacity}
          strokeWidth={polyline.strokeWidth}
          vertices={polyline.vertices}
          visible={polyline.visible}
        />
      ))}
      {drawingPath && draftVertices.length >= 2 ? (
        <PolylineHotspot
          id="path-draft"
          interactive={false}
          stroke="#75cbd3"
          strokeOpacity={1}
          strokeWidth={2}
          vertices={draftVertices}
        />
      ) : null}
      {drawingPolygon && draftVertices.length >= 3 && draftIssues.length === 0 ? (
        <PolygonHotspot
          fill="#df6b42"
          fillOpacity={draftPolygonFilled ? 0.2 : 0}
          id="polygon-draft"
          interactive={false}
          stroke="#75cbd3"
          strokeOpacity={1}
          strokeWidth={2}
          vertices={draftVertices}
        />
      ) : null}
      {selectedPolygon && tool === "select" ? selectedPolygon.vertices.map((vertex, index) => (
        <GraphicHotspot
          key={`${selectedPolygon.id}-vertex-${index}`}
          ariaLabel={`${selectedPolygon.label}, vertex ${index + 1}`}
          distance={8}
          draggable
          graphic={{
            kind: "circle",
            fill: "#f5fbfc",
            stroke: "#df6b42",
            strokeWidth: 14,
          }}
          height={2.2}
          id={`${selectedPolygon.id}-vertex-${index}`}
          onDragEnd={({ position }) => {
            const vertices = selectedPolygon.vertices.map((current, currentIndex) =>
              currentIndex === index ? position : current,
            );
            const issues = validatePolygonVertices(vertices);
            if (issues.length === 0) {
              onUpdatePolygon(selectedPolygon.id, { vertices });
              onStatus(`Vertex ${index + 1} moved to ${formatPosition(position)}.`);
            } else {
              onStatus(`Vertex move rejected: ${polygonIssueSummary(issues)}`);
            }
          }}
          onDragStart={() => onStatus(`Dragging vertex ${index + 1}.`)}
          onPositionChange={({ position }) => {
            const vertices = selectedPolygon.vertices.map((current, currentIndex) =>
              currentIndex === index ? position : current,
            );
            if (validatePolygonVertices(vertices).length === 0) {
              onUpdatePolygon(selectedPolygon.id, { vertices });
            }
          }}
          mode="billboard"
          position={vertex}
          scaleMode="fixed"
          width={2.2}
        />
      )) : null}
      {selectedPolyline && tool === "select" ? selectedPolyline.vertices.map((vertex, index) => (
        <GraphicHotspot
          key={`${selectedPolyline.id}-vertex-${index}`}
          ariaLabel={`${selectedPolyline.label}, vertex ${index + 1}`}
          distance={8}
          draggable
          graphic={{
            kind: "circle",
            fill: "#f5fbfc",
            stroke: "#df6b42",
            strokeWidth: 14,
          }}
          height={2.2}
          id={`${selectedPolyline.id}-vertex-${index}`}
          onDragEnd={({ position }) => {
            const vertices = selectedPolyline.vertices.map((current, currentIndex) =>
              currentIndex === index ? position : current,
            );
            onUpdatePolyline(selectedPolyline.id, { vertices });
            onStatus(`Vertex ${index + 1} moved to ${formatPosition(position)}.`);
          }}
          onDragStart={() => onStatus(`Dragging vertex ${index + 1}.`)}
          onPositionChange={({ position }) => {
            const vertices = selectedPolyline.vertices.map((current, currentIndex) =>
              currentIndex === index ? position : current,
            );
            onUpdatePolyline(selectedPolyline.id, { vertices });
          }}
          mode="billboard"
          position={vertex}
          scaleMode="fixed"
          width={2.2}
        />
      )) : null}
      {drawingPath ? draftVertices.map((vertex, index) => (
        <GraphicHotspot
          key={`polygon-draft-vertex-${index}`}
          ariaLabel={`Draft vertex ${index + 1}`}
          distance={8}
          graphic={{
            kind: "circle",
            fill: "#75cbd3",
            stroke: "#071316",
            strokeWidth: 12,
          }}
          height={1.8}
          id={`polygon-draft-vertex-${index}`}
          interactive={false}
          mode="billboard"
          position={vertex}
          scaleMode="fixed"
          width={1.8}
        />
      )) : null}
    </>
  );
}
