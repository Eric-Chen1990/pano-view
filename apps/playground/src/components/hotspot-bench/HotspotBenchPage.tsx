import { SiteHeader } from "../SiteHeader";
import { CanvasPanel } from "./CanvasPanel";
import { Inspector } from "./Inspector";
import { ToolRail } from "./ToolRail";
import { useHotspotBenchKeyboard } from "./use-hotspot-bench-keyboard";

export function HotspotBenchPage() {
  useHotspotBenchKeyboard();

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
        <ToolRail />
        <CanvasPanel />
        <Inspector />
      </section>

      <footer>
        <span>@ericchen1990/pano-view · point, polygon + polyline hotspots</span>
        <span>Stage 6 of 6</span>
      </footer>
    </main>
  );
}
