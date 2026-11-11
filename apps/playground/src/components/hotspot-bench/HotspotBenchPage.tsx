import { useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
import { shellClassName } from "../../ui";
import { CodeSnippet } from "../CodeSnippet";
import { SiteFooter } from "../SiteFooter";
import { SiteHeader } from "../SiteHeader";
import { buildHotspotBenchSnippet } from "./build-hotspot-snippet";
import { CanvasPanel } from "./CanvasPanel";
import { Inspector } from "./Inspector";
import { useHotspotBenchStore } from "./store";
import { ToolRail } from "./ToolRail";
import { useHotspotBenchKeyboard } from "./use-hotspot-bench-keyboard";

export function HotspotBenchPage() {
  useHotspotBenchKeyboard();
  const { selectedId, hotspots, polygons, polylines } = useHotspotBenchStore(
    useShallow((state) => ({
      selectedId: state.selectedId,
      hotspots: state.hotspots,
      polygons: state.polygons,
      polylines: state.polylines,
    })),
  );
  const snippet = useMemo(
    () =>
      buildHotspotBenchSnippet({
        selectedId,
        hotspots,
        polygons,
        polylines,
      }),
    [hotspots, polygons, polylines, selectedId],
  );

  return (
    <main className={shellClassName}>
      <SiteHeader />

      <section
        aria-labelledby="page-title"
        className="grid items-end gap-[clamp(32px,8vw,128px)] py-[clamp(42px,7vw,86px)] pr-0 pb-[31px] grid-cols-[minmax(0,1.2fr)_minmax(300px,0.64fr)] max-[760px]:grid-cols-1 max-[760px]:gap-[22px] max-[760px]:py-[42px] max-[760px]:pb-[27px]"
      >
        <div>
          <p className="font-mono text-[0.67rem] tracking-[0.08em] text-[#df6b42] uppercase">
            Panorama hotspot bench
          </p>
          <h1
            className="m-0 text-[clamp(3rem,7vw,6rem)] leading-[0.92] font-black tracking-tight text-[#f5fbfc]"
            id="page-title"
          >
            Place hotspots
            <br />
            on the panorama
          </h1>
        </div>
        <p className="m-0 max-w-[36rem] text-[0.95rem] leading-7 text-[#9ab1b7]">
          Choose a ready-made preset for any of the nine hotspot types, then place media, draw regions or paths and edit their properties. Preset selection preserves your edits.
        </p>
      </section>

      <section
        id="workspace"
        aria-label="Hotspot authoring workspace"
        className="grid grid-cols-[132px_minmax(0,1fr)_340px] border border-[#244047] bg-[#071316]/80 max-[1180px]:grid-cols-[132px_minmax(0,1fr)] max-[760px]:block"
      >
        <ToolRail />
        <CanvasPanel />
        <Inspector />
      </section>

      <section className="mt-6" aria-label="Hotspot code example">
        <CodeSnippet
          blurb={snippet.blurb}
          code={snippet.code}
          label={snippet.label}
        />
      </section>

      <SiteFooter label="@ericchen1990/pano-view · point, polygon + polyline hotspots" />
    </main>
  );
}
