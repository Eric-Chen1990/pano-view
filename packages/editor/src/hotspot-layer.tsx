import { memo } from "react";
import { hotspotAction } from "@ericchen1990/pano-view/data";
import {
  ImageHotspot,
  GraphicHotspot,
  SequenceHotspot,
  VideoHotspot,
  AudioHotspot,
  TextHotspot,
  IframeHotspot,
  CalloutHotspot,
  PolygonHotspot,
  PolylineHotspot,
  PortalHotspot,
  type HotspotCornersChangeEvent,
  type HotspotPosition,
  type ProjectHotspotDefinition,
} from "@ericchen1990/pano-view";
import { CornerHandles } from "./corner-handles";
import { PortalHandles } from "./portal-handles";
import type { Translate } from "./i18n";
import { type HotspotGeometryPatch, geometryIssue } from "./document";
import { errorMessage } from "./errors";

type Props = {
  hotspots: ProjectHotspotDefinition[];
  selectedId?: string;
  viewportHeight: number;
  drawing: boolean;
  draft: HotspotPosition[];
  draftKind?: "polygon" | "polyline";
  onSelect: (id: string) => void;
  onUpdate: (
    id: string,
    patch: HotspotGeometryPatch,
  ) => void;
  onBegin: () => void;
  onEnd: () => void;
  onError: (message: string) => void;
  t: Translate;
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
  viewportHeight,
  drawing,
  draft,
  draftKind,
  onSelect,
  onUpdate,
  onBegin,
  onEnd,
  onError,
  t,
}: Props) {
  const selected = hotspots.find((hotspot) => hotspot.id === selectedId);
  const selectedPortal = !drawing && selected?.type === "portal" ? selected : undefined;
  const cornerHotspot = !drawing && (selected?.type === "image" || selected?.type === "video") && selected.corners
    ? selected
    : undefined;
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
          // A tooltip can cover nearby handles while editing corners.
          ...(cornerHotspot || selectedPortal ? { tooltip: undefined } : {}),
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
        const mediaCornerProps = (hotspot.type === "image" || hotspot.type === "video") && hotspot.corners
          ? {
            onPositionChange: undefined,
            onCornersChange: ({ corners }: HotspotCornersChangeEvent) => onUpdate(hotspot.id, { corners }),
          }
          : {};
        switch (hotspot.type) {
          case "portal": {
            const action = hotspotAction(hotspot, "click");
            return <PortalHotspot key={hotspot.id} {...renderProps(hotspot)} {...point}
              enterOnZoom={false}
              targetSceneId={action?.type === "scene" ? action.sceneId : ""}
              onError={(error) => onError(`${hotspot.id}: ${String(error)}`)} />;
          }
          case "image":
            return (
              <ImageHotspot
                key={hotspot.id}
                {...renderProps(hotspot)}
                {...point}
                {...mediaCornerProps}
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
                {...mediaCornerProps}
                preload={hotspot.chromaKey ? "auto" : hotspot.preload}
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
          case "callout":
            return (
              <CalloutHotspot
                key={hotspot.id}
                {...renderProps(hotspot)}
                {...point}
              />
            );
        }
      })}
      {cornerHotspot?.corners ? (
        <CornerHandles
          key={cornerHotspot.id}
          id={cornerHotspot.id}
          corners={cornerHotspot.corners}
          viewportHeight={viewportHeight}
          onChange={(corners) => onUpdate(cornerHotspot.id, { corners })}
          onBegin={onBegin}
          onEnd={onEnd}
          t={t}
        />
      ) : null}
      {selectedPortal ? (
        <PortalHandles
          key={selectedPortal.id}
          portal={selectedPortal}
          viewportHeight={viewportHeight}
          onChange={(patch) => onUpdate(selectedPortal.id, patch)}
          onBegin={onBegin}
          onEnd={onEnd}
          t={t}
        />
      ) : null}
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
