import { usePlaygroundLanguage } from "../../i18n/language";
import { PlanarTileViewer } from "@ericchen1990/pano-view";
import { useState } from "react";
import {
  checkboxLabelClassName, controlInputClassName, controlLabelClassName,
  pageControlsClassName, pageSectionClassName, shellClassName,
} from "../../ui";
import { ExampleCode } from "../ExampleCode";
import { PageHeading } from "../PageHeading";
import { SiteFooter } from "../SiteFooter";
import { SiteHeader } from "../SiteHeader";

const manifestUrl = "/fixtures/planar-compare/v1/image1.tiles/manifest.json";
const alt = "Original plaza photograph";
export function PlanarTilePage() {
  const { t } = usePlaygroundLanguage();
  const [maxScale, setMaxScale] = useState<number>();
  const [bounce, setBounce] = useState(true);
  const [showMinimap, setShowMinimap] = useState(false);
  const options = [
    maxScale === undefined ? "" : `      maxScale={${maxScale}}\n`,
    bounce ? "" : "      dragMotion={{ bounce: false }}\n",
    showMinimap ? "      showMinimap\n" : "",
  ].join("");
  const snippet = `import { PlanarTileViewer } from "@ericchen1990/pano-view";
import "@ericchen1990/pano-view/styles.css";

export function FlatImage() {
  return (
    <PlanarTileViewer
      manifestUrl="${manifestUrl}"
      alt="${alt}"
${options}      style={{ height: 480 }}
    />
  );
}`;

  return (
    <main className={shellClassName}>
      <SiteHeader />
      <section className={`${pageSectionClassName} mt-8`} aria-labelledby="planar-tile-title">
        <PageHeading
          id="planar-tile-title"
          eyebrow={t("Start")}
          title={t("Tiled flat image")}
          description={t("Drag to pan, scroll or pinch to zoom, and choose Fit to see the full image.")}
        />
        <div className={pageControlsClassName}>
          <label className={controlLabelClassName}>{t("Maximum zoom")}<select
              className={controlInputClassName}
              value={maxScale ?? ""}
              onChange={(event) => setMaxScale(event.target.value ? Number(event.target.value) : undefined)}
            >
              <option value="">{t("Automatic")}</option>
              <option value={2}>2×</option>
              <option value={3}>3×</option>
            </select>
          </label>
          <label className={checkboxLabelClassName}>
            <input type="checkbox" checked={bounce} onChange={(event) => setBounce(event.target.checked)} />{t("Edge bounce")}</label>
          <label className={checkboxLabelClassName}>
            <input type="checkbox" checked={showMinimap} onChange={(event) => setShowMinimap(event.target.checked)} />{t("Minimap")}</label>
        </div>
        <PlanarTileViewer
          manifestUrl={manifestUrl}
          alt={alt}
          maxScale={maxScale}
          dragMotion={{ bounce }}
          showMinimap={showMinimap}
          className="rounded-xl"
          style={{ height: "clamp(320px, 65vh, 600px)" }}
        />
        <div className="mt-6">
          <ExampleCode
            json={{ format: "manifest", files: [{ label: "manifest.json", blurb: t("Use this converter manifest URL as PlanarTileViewer’s manifestUrl."), url: manifestUrl }] }}
            react={{
              label: "React",
              blurb: t("Point the viewer at the generated manifest."),
              code: snippet,
            }}
          />
        </div>
      </section>
      <SiteFooter label={t("Pano View Playground by")} />
    </main>
  );
}
