import {
  GraphicHotspot,
  ImageHotspot,
  PanoFilter,
  PanoViewer,
  Sphere,
  Tile,
  type PanoFilterPreset,
} from "@ericchen1990/pano-view";
import { useMemo, useState } from "react";
import { FILTER_PRESET_GROUPS, TRANSITION_SCENES } from "../../constants";
import { cn } from "../../cn";
import {
  controlInputClassName,
  controlLabelClassName,
  eyebrowClassName,
  pageControlsClassName,
  pageHeadingStatusClassName,
  pageHeadingTitleClassName,
  pageHeadingWrapClassName,
  pageSectionClassName,
  segmentedButtonActiveClassName,
  segmentedButtonClassName,
  shellClassName,
} from "../../ui";
import { CodeSnippet } from "../CodeSnippet";
import { SiteFooter } from "../SiteFooter";
import { SiteHeader } from "../SiteHeader";

const SPHERE_SCENE = TRANSITION_SCENES[0];
const TILE_SCENE = TRANSITION_SCENES[2];

type SourceKind = "sphere" | "tile";

function FilterHotspots() {
  return (
    <>
      <ImageHotspot
        ariaLabel="Unfiltered image hotspot"
        height={6}
        id="filter-image-marker"
        position={{ yaw: 18, pitch: 5 }}
        src="/fixtures/hotspots/signal.svg"
        tooltip="Hotspots stay unfiltered"
        tooltipTrigger="hover"
        width={6}
      />
      <GraphicHotspot
        ariaLabel="Unfiltered graphic hotspot"
        graphic={{ fill: "#df6b42", kind: "circle" }}
        height={8}
        id="filter-graphic-marker"
        position={{ yaw: -28, pitch: -6 }}
        tooltip="Original hotspot color"
        tooltipTrigger="hover"
        width={8}
      />
    </>
  );
}

function buildFilterSnippet(
  source: SourceKind,
  preset: PanoFilterPreset,
  intensity: number,
): string {
  const intensityLiteral =
    Number.isInteger(intensity) ? String(intensity) : intensity.toFixed(2);
  const sourceBlock =
    source === "sphere"
      ? `  <Sphere
    src="/fixtures/panorama/panos/1/sphere.webp"
    previewUrl="preview.webp"
  />`
      : `  <Tile
    baseUrl="/fixtures/panorama/cube-tiles/3"
    multires="512,1000,2000"
    urlTemplate="tiles/%s/l%l/%v/l%l_%s_%v_%h.webp"
    previewUrl="previews/cube-vertical.webp"
  />`;

  return `import {
  GraphicHotspot,
  ImageHotspot,
  PanoFilter,
  PanoViewer,
  ${source === "sphere" ? "Sphere" : "Tile"},
} from "@ericchen1990/pano-view";

{/* PanoFilter grades only the panorama source by default; hotspots keep their color. */}
<PanoViewer style={{ height: 540 }}>
  <PanoFilter preset="${preset}" intensity={${intensityLiteral}} />
${sourceBlock}
  <ImageHotspot
    id="filter-image-marker"
    position={{ yaw: 18, pitch: 5 }}
    src="/fixtures/hotspots/signal.svg"
    tooltip="Hotspots stay unfiltered"
    tooltipTrigger="hover"
    width={6}
    height={6}
  />
  <GraphicHotspot
    id="filter-graphic-marker"
    position={{ yaw: -28, pitch: -6 }}
    graphic={{ fill: "#df6b42", kind: "circle" }}
    tooltip="Original hotspot color"
    tooltipTrigger="hover"
    width={8}
    height={8}
  />
</PanoViewer>`;
}

export function FilterPage() {
  const [source, setSource] = useState<SourceKind>("sphere");
  const [preset, setPreset] = useState<PanoFilterPreset>("pencil");
  const [intensity, setIntensity] = useState(1);
  const snippet = useMemo(
    () => buildFilterSnippet(source, preset, intensity),
    [intensity, preset, source],
  );

  return (
    <main className={shellClassName}>
      <SiteHeader />
      <section
        aria-labelledby="filter-bench-title"
        className={cn(pageSectionClassName, "mt-8")}
      >
        <div className={pageHeadingWrapClassName}>
          <div>
            <p className={eyebrowClassName}>Panorama filter bench</p>
            <h1 className={pageHeadingTitleClassName} id="filter-bench-title">
              Source-only looks
            </h1>
          </div>
          <p className={pageHeadingStatusClassName}>
            Filters tint Sphere, Tile, and PanoVideo. The orange marker and
            signal hotspot keep their original color.
          </p>
        </div>
        <div className={pageControlsClassName}>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Panorama source">
            <button
              className={cn(
                segmentedButtonClassName,
                source === "sphere" && segmentedButtonActiveClassName,
              )}
              onClick={() => setSource("sphere")}
              type="button"
            >
              Sphere
            </button>
            <button
              className={cn(
                segmentedButtonClassName,
                source === "tile" && segmentedButtonActiveClassName,
              )}
              onClick={() => setSource("tile")}
              type="button"
            >
              Tile
            </button>
          </div>
          <label className={controlLabelClassName}>
            Intensity {Math.round(intensity * 100)}%
            <input
              aria-label="Filter intensity"
              className={cn(controlInputClassName, "w-40")}
              max={1}
              min={0}
              onChange={(event) => setIntensity(Number(event.target.value))}
              step={0.01}
              type="range"
              value={intensity}
            />
          </label>
        </div>
        <div className="grid gap-4 border-b border-[#244047] px-6 py-4">
          {FILTER_PRESET_GROUPS.map((group) => (
            <div className="grid gap-2" key={group.label}>
              <p className="m-0 font-mono text-[0.68rem] font-semibold tracking-[0.1em] text-[#75cbd3] uppercase">
                {group.label}
              </p>
              <div className="flex flex-wrap gap-1.5" role="group" aria-label={`${group.label} filters`}>
                {group.presets.map((entry) => (
                  <button
                    className={cn(
                      segmentedButtonClassName,
                      preset === entry.value && segmentedButtonActiveClassName,
                    )}
                    key={entry.value}
                    onClick={() => setPreset(entry.value)}
                    type="button"
                  >
                    {entry.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="bg-[#020607] p-0">
          <PanoViewer
            aria-label="Panorama filter demo"
            style={{ height: 540 }}
          >
            <PanoFilter intensity={intensity} preset={preset} />
            {source === "sphere" && SPHERE_SCENE?.type === "sphere" ? (
              <Sphere
                src={SPHERE_SCENE.src}
                previewUrl={SPHERE_SCENE.previewUrl}
                yawOffset={SPHERE_SCENE.yawOffset}
              />
            ) : null}
            {source === "tile" && TILE_SCENE?.type === "tile" ? (
              <Tile
                baseUrl={TILE_SCENE.baseUrl}
                maxConcurrentLoads={3}
                maxTextureMemoryMb={96}
                multires={TILE_SCENE.multires}
                urlTemplate={TILE_SCENE.urlTemplate}
                previewUrl={TILE_SCENE.previewUrl}
              />
            ) : null}
            <FilterHotspots />
          </PanoViewer>
        </div>
        <CodeSnippet
          blurb="PanoFilter applies the selected preset and intensity to Sphere, Tile, or PanoVideo. Hotspots stay unfiltered unless colorMatrixScope is set to all."
          code={snippet}
          label="PanoFilter"
        />
      </section>
      <SiteFooter label="@ericchen1990/pano-view · panorama filters" />
    </main>
  );
}
