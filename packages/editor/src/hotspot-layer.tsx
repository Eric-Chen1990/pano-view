import { memo } from "react";
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
  type HotspotPosition,
  type ProjectHotspotDefinition,
} from "@ericchen1990/pano-view";
import { geometryIssue } from "./document";
import { errorMessage } from "./errors";

type Props = {
  hotspots: ProjectHotspotDefinition[];
  selectedId?: string;
  drawing: boolean;
  draft: HotspotPosition[];
  draftKind?: "polygon" | "polyline";
  onSelect: (id: string) => void;
  onUpdate: (
    id: string,
    patch: { position?: HotspotPosition; vertices?: HotspotPosition[] },
  ) => void;
  onBegin: () => void;
  onEnd: () => void;
  onError: (message: string) => void;
};

function renderProps<T extends ProjectHotspotDefinition>({
  type: _type,
  action: _action,
  label: _label,
  ...props
}: T) {
  return props;
}

export const HotspotLayer = memo(function HotspotLayer({
  hotspots,
  selectedId,
  drawing,
  draft,
  draftKind,
  onSelect,
  onUpdate,
  onBegin,
  onEnd,
  onError,
}: Props) {
  const selected = hotspots.find((hotspot) => hotspot.id === selectedId);
  function verticesUpdate(
    hotspot: ProjectHotspotDefinition,
    vertices: HotspotPosition[],
  ) {
    const issue = geometryIssue({
      ...hotspot,
      vertices,
    } as ProjectHotspotDefinition);
    if (!issue) onUpdate(hotspot.id, { vertices });
    else onError(issue);
  }
  return (
    <>
      {hotspots.map((hotspot) => {
        const common = {
          ariaLabel: hotspot.label || hotspot.id,
          id: hotspot.id,
          visible: hotspot.id === selectedId || hotspot.visible !== false,
          interactive: !drawing,
          pointerEvents: "auto" as const,
          draggable: !drawing,
          onClick: () => onSelect(hotspot.id),
          onDragStart: () => {
            onSelect(hotspot.id);
            onBegin();
          },
          onDragEnd: () => onEnd(),
        };
        if (hotspot.type === "polygon")
          return (
            <PolygonHotspot
              key={hotspot.id}
              {...renderProps(hotspot)}
              {...common}
              onVerticesChange={({ vertices }) =>
                verticesUpdate(hotspot, vertices)
              }
            />
          );
        if (hotspot.type === "polyline")
          return (
            <PolylineHotspot
              key={hotspot.id}
              {...renderProps(hotspot)}
              {...common}
              onVerticesChange={({ vertices }) =>
                verticesUpdate(hotspot, vertices)
              }
            />
          );
        const point = {
          ...common,
          selected: hotspot.id === selectedId,
          onPositionChange: ({ position }: { position: HotspotPosition }) =>
            onUpdate(hotspot.id, { position }),
        };
        switch (hotspot.type) {
          case "image":
            return (
              <ImageHotspot
                key={hotspot.id}
                {...renderProps(hotspot)}
                {...point}
                onError={(error) => onError(`${hotspot.id}: ${String(error)}`)}
              />
            );
          case "graphic":
            return (
              <GraphicHotspot
                key={hotspot.id}
                {...renderProps(hotspot)}
                {...point}
                onError={(error) => onError(`${hotspot.id}: ${String(error)}`)}
              />
            );
          case "text":
            return (
              <TextHotspot
                key={hotspot.id}
                {...renderProps(hotspot)}
                {...point}
              />
            );
          case "sequence":
            return (
              <SequenceHotspot
                key={hotspot.id}
                {...renderProps(hotspot)}
                {...point}
                playing={false}
                onError={(error) => onError(`${hotspot.id}: ${String(error)}`)}
              />
            );
          case "video":
            return (
              <VideoHotspot
                key={hotspot.id}
                {...renderProps(hotspot)}
                {...point}
                playing={false}
                onError={(error) => onError(`${hotspot.id}: ${String(error)}`)}
              />
            );
          case "audio":
            return (
              <AudioHotspot
                key={hotspot.id}
                {...renderProps(hotspot)}
                {...point}
                playing={false}
                marker
                onError={({ error }) =>
                  onError(`${hotspot.id}: ${errorMessage(error)}`)
                }
              />
            );
          case "iframe":
            return (
              <IframeHotspot
                key={hotspot.id}
                {...renderProps(hotspot)}
                {...point}
                pointerPolicy="hotspot"
                sandbox=""
                referrerPolicy={undefined}
              />
            );
        }
      })}
      {selected && "vertices" in selected && !drawing
        ? selected.vertices.map((vertex, index) => (
            <GraphicHotspot
              key={`${selected.id}:${index}`}
              id={`editor-vertex-${index}`}
              ariaLabel={`Vertex ${index + 1}`}
              position={vertex}
              width={1.2}
              height={1.2}
              distance={8}
              mode="billboard"
              scaleMode="fixed"
              graphic={{
                kind: "circle",
                fill: "#ffffff",
                stroke: "#df6b42",
                strokeWidth: 14,
              }}
              draggable
              onDragStart={onBegin}
              onDragEnd={onEnd}
              onPositionChange={({ position }) =>
                verticesUpdate(
                  selected,
                  selected.vertices.map((point, i) =>
                    i === index ? position : point,
                  ),
                )
              }
            />
          ))
        : null}
      {draft.length >= 2 ? (
        <PolylineHotspot
          id="editor-draft-line"
          vertices={draft}
          stroke="#75cbd3"
          strokeWidth={2}
          interactive={false}
          pointerEvents="none"
        />
      ) : null}
      {draftKind === "polygon" &&
      draft.length >= 3 &&
      !geometryIssue({ id: "draft", type: "polygon", vertices: draft }) ? (
        <PolygonHotspot
          id="editor-draft-fill"
          vertices={draft}
          fill="#df6b42"
          fillOpacity={0.25}
          interactive={false}
          pointerEvents="none"
        />
      ) : null}
      {draft.map((position, index) => (
        <GraphicHotspot
          key={index}
          id={`editor-draft-${index}`}
          position={position}
          width={0.8}
          height={0.8}
          distance={8}
          graphic={{ kind: "circle", fill: "#75cbd3" }}
          interactive={false}
          pointerEvents="none"
        />
      ))}
    </>
  );
});
