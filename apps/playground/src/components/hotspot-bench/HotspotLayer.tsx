import {
  AudioHotspot,
  GraphicHotspot,
  IframeHotspot,
  ImageHotspot,
  PolygonHotspot,
  PolylineHotspot,
  SequenceHotspot,
  TextHotspot,
  VideoHotspot,
  validatePolygonVertices,
  type HotspotPosition,
} from "@ericchen1990/pano-view";
import { memo, useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
import { formatPosition, polygonIssueSummary } from "../../utils";
import {
  selectDrawingPath,
  selectDrawingPolygon,
  selectSelectedPolygon,
  selectSelectedPolyline,
  useHotspotBenchStore,
} from "./store";

export const HotspotLayer = memo(function HotspotLayer() {
  const {
    tool,
    drawingPath,
    drawingPolygon,
    draftVertices,
    draftPolygonFilled,
    hotspots,
    polygons,
    polylines,
    selectedPolygon,
    selectedPolyline,
    selectItem,
    updateHotspot,
    updateSequence,
    updateVideo,
    updateAudio,
    updatePolygon,
    updatePolyline,
    setLastAction,
  } = useHotspotBenchStore(
    useShallow((state) => ({
      tool: state.tool,
      drawingPath: selectDrawingPath(state),
      drawingPolygon: selectDrawingPolygon(state),
      draftVertices: state.draftVertices,
      draftPolygonFilled: state.draftPolygonFilled,
      hotspots: state.hotspots,
      polygons: state.polygons,
      polylines: state.polylines,
      selectedPolygon: selectSelectedPolygon(state),
      selectedPolyline: selectSelectedPolyline(state),
      selectItem: state.selectItem,
      updateHotspot: state.updateHotspot,
      updateSequence: state.updateSequence,
      updateVideo: state.updateVideo,
      updateAudio: state.updateAudio,
      updatePolygon: state.updatePolygon,
      updatePolyline: state.updatePolyline,
      setLastAction: state.setLastAction,
    })),
  );
  const draftIssues = useMemo(
    () =>
      draftVertices.length > 0 ? validatePolygonVertices(draftVertices) : [],
    [draftVertices],
  );

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
          pointerEvents: hotspot.pointerEvents,
          position: hotspot.position,
          rotation: hotspot.rotation,
          scale: hotspot.scale,
          scaleMode: hotspot.scaleMode,
          visible: hotspot.visible,
          width: hotspot.width,
          height: hotspot.height,
          tooltip: hotspot.tooltip,
          tooltipTrigger: hotspot.tooltipTrigger,
          tooltipPlacement: hotspot.tooltipPlacement,
          tooltipOffset: hotspot.tooltipOffset,
          tooltipAppearance: hotspot.tooltipAppearance,
          onClick: () => {
            selectItem(hotspot.id);
            if (hotspot.type === "sequence") {
              updateSequence(hotspot.id, { playing: !hotspot.playing });
            }
            if (hotspot.type === "video") {
              updateVideo(hotspot.id, { playing: !hotspot.playing });
            }
            if (hotspot.type === "audio") {
              updateAudio(hotspot.id, { playing: !hotspot.playing });
            }
            setLastAction(`${hotspot.label} selected.`);
          },
          onDragStart: () => {
            selectItem(hotspot.id);
            setLastAction(`Dragging ${hotspot.label}.`);
          },
          onPositionChange: ({ position }: { position: HotspotPosition }) => {
            updateHotspot(hotspot.id, { position });
          },
          onDragEnd: ({ position }: { position: HotspotPosition }) => {
            setLastAction(`${hotspot.label} moved to ${formatPosition(position)}.`);
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
              onEnded={() => updateSequence(hotspot.id, { playing: false })}
            />
          );
        }
        if (hotspot.type === "video") {
          return (
            <VideoHotspot
              key={hotspot.id}
              {...sharedProps}
              loop={hotspot.loop}
              muted={hotspot.muted}
              onEnded={() => updateVideo(hotspot.id, { playing: false })}
              playing={hotspot.playing}
              poster={hotspot.poster}
              src={hotspot.src}
              volume={hotspot.volume}
            />
          );
        }
        if (hotspot.type === "audio") {
          return (
            <AudioHotspot
              key={hotspot.id}
              {...sharedProps}
              icon={hotspot.icon || undefined}
              playingIcon={hotspot.playingIcon || undefined}
              loop={hotspot.loop}
              marker={hotspot.marker}
              muted={hotspot.muted}
              onEnded={() => updateAudio(hotspot.id, { playing: false })}
              pauseWhenHidden={hotspot.pauseWhenHidden}
              playing={hotspot.playing}
              range={hotspot.range}
              src={hotspot.src}
              volume={hotspot.volume}
            />
          );
        }
        if (hotspot.type === "text") {
          return (
            <TextHotspot
              key={hotspot.id}
              {...sharedProps}
              align={hotspot.align}
              background={hotspot.background}
              backgroundOpacity={hotspot.backgroundOpacity}
              color={hotspot.color}
              fontFamily={hotspot.fontFamily}
              fontSize={hotspot.fontSize}
              fontStyle={hotspot.fontStyle}
              fontWeight={hotspot.fontWeight}
              text={hotspot.text}
              verticalAlign={hotspot.verticalAlign}
              whiteSpace={hotspot.whiteSpace}
            />
          );
        }
        if (hotspot.type === "iframe") {
          return (
            <IframeHotspot
              key={hotspot.id}
              {...sharedProps}
              pointerPolicy={hotspot.pointerPolicy}
              sandbox={hotspot.sandbox}
              src={hotspot.src}
              title={hotspot.title}
            />
          );
        }
        const exhaustive: never = hotspot;
        throw new Error(`Unhandled hotspot type: ${exhaustive}`);
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
          pointerEvents={polygon.pointerEvents}
          onClick={() => {
            selectItem(polygon.id);
            setLastAction(`${polygon.label} selected.`);
          }}
          onDragEnd={({ vertices }) => {
            const issues = validatePolygonVertices(vertices);
            if (issues.length === 0) {
              updatePolygon(polygon.id, { vertices });
              setLastAction(`${polygon.label} moved.`);
            } else {
              setLastAction(`Polygon move rejected: ${polygonIssueSummary(issues)}`);
            }
          }}
          onDragStart={() => {
            selectItem(polygon.id);
            setLastAction(`Dragging ${polygon.label}.`);
          }}
          onVerticesChange={({ vertices }) => {
            if (validatePolygonVertices(vertices).length === 0) {
              updatePolygon(polygon.id, { vertices });
            }
          }}
          stroke={polygon.stroke}
          strokeDashSize={polygon.strokeDashSize}
          strokeGapSize={polygon.strokeGapSize}
          strokeOpacity={polygon.strokeOpacity}
          strokeWidth={polygon.strokeWidth}
          tooltip={polygon.tooltip}
          tooltipAppearance={polygon.tooltipAppearance}
          tooltipOffset={polygon.tooltipOffset}
          tooltipPlacement={polygon.tooltipPlacement}
          tooltipTrigger={polygon.tooltipTrigger}
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
          pointerEvents={polyline.pointerEvents}
          onClick={() => {
            selectItem(polyline.id);
            setLastAction(`${polyline.label} selected.`);
          }}
          onDragEnd={({ vertices }) => {
            updatePolyline(polyline.id, { vertices });
            setLastAction(`${polyline.label} moved.`);
          }}
          onDragStart={() => {
            selectItem(polyline.id);
            setLastAction(`Dragging ${polyline.label}.`);
          }}
          onVerticesChange={({ vertices }) => updatePolyline(polyline.id, { vertices })}
          stroke={polyline.stroke}
          strokeDashSize={polyline.strokeDashSize}
          strokeGapSize={polyline.strokeGapSize}
          strokeOpacity={polyline.strokeOpacity}
          strokeWidth={polyline.strokeWidth}
          tooltip={polyline.tooltip}
          tooltipAppearance={polyline.tooltipAppearance}
          tooltipOffset={polyline.tooltipOffset}
          tooltipPlacement={polyline.tooltipPlacement}
          tooltipTrigger={polyline.tooltipTrigger}
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
          height={1.5}
          width={1.5}
          id={`${selectedPolygon.id}-vertex-${index}`}
          onDragEnd={({ position }) => {
            const vertices = selectedPolygon.vertices.map((current, currentIndex) =>
              currentIndex === index ? position : current,
            );
            const issues = validatePolygonVertices(vertices);
            if (issues.length === 0) {
              updatePolygon(selectedPolygon.id, { vertices });
              setLastAction(`Vertex ${index + 1} moved to ${formatPosition(position)}.`);
            } else {
              setLastAction(`Vertex move rejected: ${polygonIssueSummary(issues)}`);
            }
          }}
          onDragStart={() => setLastAction(`Dragging vertex ${index + 1}.`)}
          onPositionChange={({ position }) => {
            const vertices = selectedPolygon.vertices.map((current, currentIndex) =>
              currentIndex === index ? position : current,
            );
            if (validatePolygonVertices(vertices).length === 0) {
              updatePolygon(selectedPolygon.id, { vertices });
            }
          }}
          mode="billboard"
          position={vertex}
          scaleMode="fixed"       
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
          height={1.1}
          id={`${selectedPolyline.id}-vertex-${index}`}
          onDragEnd={({ position }) => {
            const vertices = selectedPolyline.vertices.map((current, currentIndex) =>
              currentIndex === index ? position : current,
            );
            updatePolyline(selectedPolyline.id, { vertices });
            setLastAction(`Vertex ${index + 1} moved to ${formatPosition(position)}.`);
          }}
          onDragStart={() => setLastAction(`Dragging vertex ${index + 1}.`)}
          onPositionChange={({ position }) => {
            const vertices = selectedPolyline.vertices.map((current, currentIndex) =>
              currentIndex === index ? position : current,
            );
            updatePolyline(selectedPolyline.id, { vertices });
          }}
          mode="billboard"
          position={vertex}
          scaleMode="fixed"
          width={1.1}
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
          height={0.9}
          id={`polygon-draft-vertex-${index}`}
          interactive={false}
          mode="billboard"
          position={vertex}
          scaleMode="fixed"
          width={0.9}
        />
      )) : null}
    </>
  );
});
