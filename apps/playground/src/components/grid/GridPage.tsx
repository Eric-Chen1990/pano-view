import { usePlaygroundLanguage } from "../../i18n/language";
import {
  PanoGrid,
  PanoViewer,
  type PanoGridProjection,
} from "@ericchen1990/pano-view";
import { useState } from "react";
import { cn } from "../../cn";
import {
  controlInputClassName,
  controlLabelClassName,
  pageControlsClassName,
  pageSectionClassName,
  playgroundViewerHeight,
  segmentedButtonClassName,
  shellClassName,
} from "../../ui";
import { ExampleCode } from "../ExampleCode";
import { PageHeading } from "../PageHeading";
import { SiteFooter } from "../SiteFooter";
import { SiteHeader } from "../SiteHeader";

const PROJECTIONS = [
  { value: "sphere" as const, label: "Sphere" },
  { value: "cube" as const, label: "Cube" },
];

function GridSlider({
  label,
  min,
  max,
  step,
  value,
  valueText,
  onChange,
}: {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  valueText: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className={controlLabelClassName}>
      <span>
        {label} <span aria-hidden="true">{valueText}</span>
      </span>
      <input
        className={cn(
          controlInputClassName,
          "w-36 p-0 focus-visible:outline-2 focus-visible:outline-[#75cbd3]",
        )}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(event.currentTarget.valueAsNumber)}
      />
    </label>
  );
}

export function GridPage() {
  const { t } = usePlaygroundLanguage();
  const [projection, setProjection] = useState<PanoGridProjection>("sphere");
  const [sphereDivisions, setSphereDivisions] = useState(8);
  const [cubeDivisions, setCubeDivisions] = useState(8);
  const [color, setColor] = useState("#7dffe1");
  const [opacity, setOpacity] = useState(0.8);

  const divisions = projection === "sphere" ? sphereDivisions : cubeDivisions;
  const minDivisions = projection === "sphere" ? 2 : 1;
  const setDivisions = projection === "sphere" ? setSphereDivisions : setCubeDivisions;
  const resolvedDivisions = Math.max(minDivisions, divisions);

  const code = `import { PanoGrid, PanoViewer } from "@ericchen1990/pano-view";
import "@ericchen1990/pano-view/styles.css";

export function PanoramaGrid() {
  return (
    <PanoViewer style={{ height: ${JSON.stringify(playgroundViewerHeight)} }}>
      <PanoGrid
        projection="${projection}"
        divisions={${resolvedDivisions}}
        color="${color}"
        opacity={${opacity}}
      />
    </PanoViewer>
  );
}`;

  return (
    <main className={shellClassName}>
      <SiteHeader />
      <section aria-labelledby="grid-title" className={cn(pageSectionClassName, "mt-8")}>
        <PageHeading
          id="grid-title"
          eyebrow={t("Start")}
          title={t("Panorama grid")}
          description={t(
            "A debug grid that forms panorama space without an image. Switch sphere or cube, then adjust line color and density.",
          )}
        />
        <div className={pageControlsClassName}>
          <div className={controlLabelClassName}>
            {t("Projection")}
            <div className="flex flex-wrap gap-1.5" role="group" aria-label={t("Projection")}>
              {PROJECTIONS.map(({ label, value }) => (
                <button
                  key={value}
                  type="button"
                  className={segmentedButtonClassName}
                  aria-pressed={projection === value}
                  onClick={() => setProjection(value)}
                >
                  {t(label)}
                </button>
              ))}
            </div>
          </div>
          <label className={controlLabelClassName}>
            {t("Color")}
            <input
              className={cn(controlInputClassName, "h-9 w-14 cursor-pointer p-1")}
              type="color"
              value={color}
              aria-label={t("Color")}
              onChange={(event) => setColor(event.currentTarget.value)}
            />
          </label>
        </div>
        <div className={pageControlsClassName} role="group" aria-label={t("Grid settings")}>
          <GridSlider
            label={t("Density")}
            min={minDivisions}
            max={64}
            step={1}
            value={resolvedDivisions}
            valueText={String(resolvedDivisions)}
            onChange={setDivisions}
          />
          <GridSlider
            label={t("Opacity")}
            min={0.1}
            max={1}
            step={0.05}
            value={opacity}
            valueText={opacity.toFixed(2)}
            onChange={setOpacity}
          />
        </div>
        <PanoViewer
          aria-label={t("Panorama grid demo")}
          style={{ height: playgroundViewerHeight, background: "#0b1214" }}
        >
          <PanoGrid
            projection={projection}
            divisions={resolvedDivisions}
            color={color}
            opacity={opacity}
          />
        </PanoViewer>
        <ExampleCode
          react={{
            label: "PanoGrid",
            blurb: t("Use the current grid settings in an empty viewer."),
            code,
          }}
        />
      </section>
      <SiteFooter label="@ericchen1990/pano-view · Panorama grid" />
    </main>
  );
}
