import { SiteHeader } from "../SiteHeader";
import { CanvasPanel } from "./CanvasPanel";
import { Inspector } from "./Inspector";
import { ToolRail } from "./ToolRail";
import { useHotspotBench } from "./use-hotspot-bench";

export function HotspotBenchPage() {
  const bench = useHotspotBench();

  const selectItem = (id: string, message?: string) => {
    bench.setSelectedId(id);
    bench.setTool("select");
    if (message) bench.setLastAction(message);
  };

  return (
    <main className="app-shell">
      <SiteHeader />

      <section className="authoring-intro" aria-labelledby="page-title">
        <div>
          <p className="eyebrow">Panorama hotspot bench</p>
          <h1 id="page-title">Place it<br />where it lives.</h1>
        </div>
        <p className="lede">
          Place media, draw local regions or open paths, then adjust every hotspot
          directly in its panoramic context.
        </p>
      </section>

      <section
        className="authoring-workspace"
        id="workspace"
        aria-label="Hotspot authoring workspace"
      >
        <ToolRail
          tool={bench.tool}
          drawingPolygon={bench.drawingPolygon}
          drawingPolyline={bench.drawingPolyline}
          hotspotCount={bench.hotspots.length + bench.polygons.length + bench.polylines.length}
          onSelectTool={bench.selectTool}
          onStartPolygon={() => {
            bench.setSelectedId(null);
            bench.setTool("polygon");
            bench.setLastAction(
              bench.draftVertices.length
                ? `Continue polygon: ${bench.draftVertices.length} vertices.`
                : "Click the panorama to add polygon vertices.",
            );
          }}
          onStartPolyline={() => {
            bench.setSelectedId(null);
            bench.setTool("polyline");
            bench.setLastAction(
              bench.draftVertices.length
                ? `Continue polyline: ${bench.draftVertices.length} vertices.`
                : "Click the panorama to add polyline vertices.",
            );
          }}
        />

        <CanvasPanel
          viewerRef={bench.viewerRef}
          mode={bench.mode}
          tool={bench.tool}
          view={bench.view}
          level={bench.level}
          progress={bench.progress}
          tileErrors={bench.tileErrors}
          autoRotate={bench.autoRotate}
          placementTool={bench.placementTool}
          drawingPath={bench.drawingPath}
          drawingPolygon={bench.drawingPolygon}
          drawingPolyline={bench.drawingPolyline}
          draftVertices={bench.draftVertices}
          draftIssues={bench.draftIssues}
          draftPolygonFilled={bench.draftPolygonFilled}
          lastAction={bench.lastAction}
          controls={bench.controls}
          hotspots={bench.hotspots}
          polygons={bench.polygons}
          polylines={bench.polylines}
          selectedPolygon={bench.selectedPolygon}
          selectedPolyline={bench.selectedPolyline}
          onSelectMode={bench.selectMode}
          onToggleAutoRotate={() => bench.setAutoRotate((current) => !current)}
          onViewChange={bench.setView}
          onLevelChange={bench.setLevel}
          onLoadProgress={bench.setProgress}
          onTileError={() => bench.setTileErrors((count) => count + 1)}
          onPanoramaClick={bench.addHotspot}
          onFinishDraft={bench.finishPolygonDraft}
          onCancelDraft={bench.cancelPolygonDraft}
          onToggleDraftFill={() => bench.setDraftPolygonFilled((current) => !current)}
          onSelectItem={(id) => selectItem(id)}
          onUpdateHotspot={bench.updateHotspot}
          onUpdateSequence={bench.updateSequence}
          onUpdateVideo={bench.updateVideo}
          onUpdatePolygon={bench.updatePolygon}
          onUpdatePolyline={bench.updatePolyline}
          onStatus={bench.setLastAction}
        />

        <Inspector
          selected={bench.selected}
          selectedPolygon={bench.selectedPolygon}
          selectedPolyline={bench.selectedPolyline}
          selectedId={bench.selectedId}
          drawingPath={bench.drawingPath}
          drawingPolygon={bench.drawingPolygon}
          drawingPolyline={bench.drawingPolyline}
          draftVertices={bench.draftVertices}
          draftIssues={bench.draftIssues}
          hotspots={bench.hotspots}
          polygons={bench.polygons}
          polylines={bench.polylines}
          onUpdateHotspot={bench.updateHotspot}
          onUpdateGraphic={bench.updateGraphic}
          onUpdateImageSource={bench.updateImageSource}
          onUpdateSequence={bench.updateSequence}
          onUpdateVideo={bench.updateVideo}
          onUpdatePolygon={bench.updatePolygon}
          onUpdatePolyline={bench.updatePolyline}
          onDeleteSelected={bench.deleteSelected}
          onResetDemo={bench.resetDemo}
          onSelectItem={selectItem}
        />
      </section>

      <footer>
        <span>@pano-view/react · point, polygon + polyline hotspots</span>
        <span>Stage 6 of 6</span>
      </footer>
    </main>
  );
}
