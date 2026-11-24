import { usePlaygroundLanguage } from "../../i18n/language";
import { cubeTileJsx, cubeTileProps } from "../../constants";
import { useEffect, useState, useSyncExternalStore, type FormEvent } from "react";
import {
  GraphicHotspot, PanoOverlay, PanoViewer, Tile, usePanoViewer,
  type PanoScreenshotFocus, type PanoScreenshotFormat, type PanoScreenshotMode, type PanoScreenshotOptions,
} from "@ericchen1990/pano-view";
import { PanoDialog } from "@ericchen1990/pano-view/ui";
import "@ericchen1990/pano-view/ui/styles.css";
import { controlInputClassName, controlLabelClassName, viewerChromeButtonClassName } from "../../ui";
import { ExampleCode } from "../ExampleCode";
import { ExamplePage } from "../ExamplePage";

const source = cubeTileProps();
const hotspot = {
  id: "hall",
  position: { yaw: 0, pitch: 3 },
  graphic: { kind: "circle", fill: "#e36e40", stroke: "#ffffff", strokeWidth: 2 },
  width: 8,
  height: 8,
  tooltip: "Main hall",
  ariaLabel: "Main hall",
} as const;
const modes: Record<PanoScreenshotMode, string> = {
  panorama: "Panorama only",
  hotspots: "Include hotspots",
  viewer: "Include viewer interface",
};

function screenshotExample(options: PanoScreenshotOptions) {
  const settings = JSON.stringify(options, null, 2).replace(/\n/g, "\n      ");
  return `import { useEffect, useState, useSyncExternalStore } from "react";
import { GraphicHotspot, PanoOverlay, PanoViewer, Tile, usePanoViewer } from "@ericchen1990/pano-view";
import "@ericchen1990/pano-view/styles.css";

export function PanoramaScreenshot() {
  const viewer = usePanoViewer();
  const progress = useSyncExternalStore(viewer.subscribeSceneLoadProgress, viewer.getSceneLoadProgress, viewer.getSceneLoadProgress);
  const [image, setImage] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => () => {
    if (image) URL.revokeObjectURL(image.url);
  }, [image]);

  async function capture() {
    setBusy(true);
    setError("");
    try {
      const blob = await viewer.captureScreenshot(${settings});
      setImage({
        url: URL.createObjectURL(blob),
        filename: blob.type === "image/jpeg" ? "my-panorama.jpg" : "my-panorama.png",
      });
    } catch (error) {
      setError(error instanceof Error ? error.message : "Screenshot failed.");
    } finally {
      setBusy(false);
    }
  }

  return <>
    <button type="button" onClick={capture} disabled={busy || progress.status !== "ready"}>Take screenshot</button>
    {error && <p role="alert">{error}</p>}
    <PanoViewer ref={viewer.ref} style={{ height: 480 }}>
      ${cubeTileJsx(source)}
      <GraphicHotspot {...${JSON.stringify(hotspot)}} />
      <PanoOverlay>
        <button type="button" style={{ pointerEvents: "auto" }} onClick={viewer.reset}>Reset view</button>
      </PanoOverlay>
    </PanoViewer>
    {image && <>
      <img src={image.url} alt="Panorama screenshot preview" style={{ maxWidth: "100%" }} />
      <a href={image.url} download={image.filename}>Download image</a>
      <button type="button" onClick={() => setImage(null)}>Close preview</button>
    </>}
  </>;
}`;
}

export function ScreenshotPage() {
  const { t } = usePlaygroundLanguage();
  const viewer = usePanoViewer();
  const progress = useSyncExternalStore(viewer.subscribeSceneLoadProgress, viewer.getSceneLoadProgress, viewer.getSceneLoadProgress);
  const [mode, setMode] = useState<PanoScreenshotMode>("panorama");
  const [format, setFormat] = useState<PanoScreenshotFormat>("png");
  const [width, setWidth] = useState("");
  const [quality, setQuality] = useState("95");
  const [focus, setFocus] = useState<PanoScreenshotFocus>("reticle");
  const [sound, setSound] = useState(true);
  const [image, setImage] = useState<{ url: string; filename: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => () => {
    if (image) URL.revokeObjectURL(image.url);
  }, [image]);

  const options: PanoScreenshotOptions = { mode, format, feedback: { sound, focus } };
  if (width) options.outputWidth = Number(width);
  if (format === "jpeg" && quality) options.quality = Number(quality);

  async function capture(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const blob = await viewer.captureScreenshot(options);
      const filename = `panorama-${mode}.${blob.type === "image/jpeg" ? "jpg" : "png"}`;
      setImage({ url: URL.createObjectURL(blob), filename });
    } catch (error) {
      setError(error instanceof Error ? error.message : "Screenshot failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ExamplePage
      eyebrow={t("Interaction")}
      title={t("Panorama screenshot")}
      description={t("Drag to frame the view, then choose which layers to capture. Preview the result and download it as a PNG or JPEG.")}
    >
      <PanoViewer ref={viewer.ref} aria-label={t("Screenshot panorama")} className="h-[540px] max-[560px]:h-[480px]">
        <Tile {...source} />
        <GraphicHotspot {...hotspot} />
        <PanoOverlay>
          <div className="pointer-events-auto absolute top-3 right-3 flex flex-wrap justify-end gap-2">
            <button type="button" className={viewerChromeButtonClassName} onClick={viewer.reset}>{t("Reset view")}</button>
            <button type="button" className={viewerChromeButtonClassName} onClick={() => {
              void viewer.toggleFullscreen().catch(() => setError("The browser did not allow fullscreen."));
            }}>{t("Toggle fullscreen")}</button>
          </div>
          <form
            onSubmit={(event) => void capture(event)}
            className="pointer-events-auto absolute right-3 bottom-3 left-3 flex flex-wrap items-end gap-2 border border-line bg-[#081619]/95 p-2.5"
          >
            <label className={controlLabelClassName}>{t("Capture area")}<select className={controlInputClassName} value={mode} onChange={(event) => setMode(event.target.value as PanoScreenshotMode)}>
                {Object.entries(modes).map(([value, label]) => <option key={value} value={value}>{t(label)}</option>)}
              </select>
            </label>
            <label className={controlLabelClassName}>{t("Format")}<select className={controlInputClassName} value={format} onChange={(event) => setFormat(event.target.value as PanoScreenshotFormat)}>
                <option value="png">PNG</option>
                <option value="jpeg">JPEG</option>
              </select>
            </label>
            <label className={controlLabelClassName}>{t("Max width (px)")}<input type="number" min="1" step="1" value={width} placeholder={t("Original")} className={`w-24 ${controlInputClassName}`} onChange={(event) => setWidth(event.target.value)} />
            </label>
            {format === "jpeg" && (
              <label className={controlLabelClassName}>{t("JPEG quality")}<input type="number" min="1" max="100" step="1" value={quality} placeholder="95" className={`w-20 ${controlInputClassName}`} onChange={(event) => setQuality(event.target.value)} />
              </label>
            )}
            <label className={controlLabelClassName}>{t("Focus effect")}<select className={controlInputClassName} value={focus} onChange={(event) => setFocus(event.target.value as PanoScreenshotFocus)}>
                <option value="none">{t("None")}</option>
                <option value="reticle">{t("Focus frame")}</option>
                <option value="lens">{t("Lens refocus")}</option>
                <option value="both">{t("Focus frame + lens")}</option>
              </select>
            </label>
            <label className="flex min-h-9 items-center gap-2 px-1 text-sm">
              <input type="checkbox" checked={sound} onChange={(event) => setSound(event.target.checked)} />{t("Shutter sound")}</label>
            <button type="submit" className={`${viewerChromeButtonClassName} disabled:opacity-50`} disabled={busy || progress.status !== "ready"}>
              {busy ? "Capturing…" : t("Take screenshot")}
            </button>
            {progress.status === "error" && <p role="alert" className="m-0 w-full text-sm">{t("Could not load the panorama.")}</p>}
            {error && <p role="alert" className="m-0 w-full text-sm">{t(error)}</p>}
          </form>
          <PanoDialog closeLabel={t("Close")}
            open={image !== null}
            onOpenChange={(open) => { if (!open) setImage(null); }}
            title={t("Screenshot preview")}
            style={{
              width: "min(1120px, var(--pano-dialog-available-width), max(360px, calc(var(--pano-dialog-available-width) * 0.84)))",
              height: "min(820px, var(--pano-dialog-available-height), max(300px, calc(var(--pano-dialog-available-height) * 0.82)))",
            }}
          >
            {image && (
              <div className="grid h-full min-h-0 grid-rows-[minmax(0,1fr)_auto] gap-3">
                <img className="h-full min-h-0 w-full object-contain" src={image.url} alt={t("Panorama screenshot preview")} />
                <a className={`justify-self-end ${viewerChromeButtonClassName}`} href={image.url} download={image.filename}>{t("Download") + " "}{image.filename.endsWith(".jpg") ? "JPEG" : "PNG"}</a>
              </div>
            )}
          </PanoDialog>
        </PanoOverlay>
      </PanoViewer>
      <ExampleCode react={{
        label: t("Capture the current panorama"),
        blurb: t("The options below follow the settings above. The viewer returns a Blob for previewing or downloading."),
        code: screenshotExample(options),
      }} />
    </ExamplePage>
  );
}
