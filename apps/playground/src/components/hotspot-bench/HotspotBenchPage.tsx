import { SiteHeader } from "../SiteHeader";
import { footerClassName, shellClassName } from "../../ui";
import { CanvasPanel } from "./CanvasPanel";
import { Inspector } from "./Inspector";
import { ToolRail } from "./ToolRail";
import { useHotspotBenchKeyboard } from "./use-hotspot-bench-keyboard";

export function HotspotBenchPage() {
  useHotspotBenchKeyboard();

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
          Place media, draw local regions or open paths, then adjust every hotspot
          directly in its panoramic context.
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

      <footer className={footerClassName}>
        <span>@ericchen1990/pano-view · point, polygon + polyline hotspots</span>
        <span>Stage 6 of 6</span>
      </footer>
    </main>
  );
}
