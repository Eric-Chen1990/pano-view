import { usePlaygroundLanguage } from "../../i18n/language";
import { cubeTileJsx } from "../../constants";
import { useState } from "react";
import { cn } from "../../cn";
import {
  controlLabelClassName,
  pageControlsClassName,
  segmentedButtonClassName,
  segmentedButtonActiveClassName,
} from "../../ui";
import { ExamplePage } from "../ExamplePage";
import { ExampleCode } from "../ExampleCode";
import { CodeSnippet } from "../CodeSnippet";
import { SpatialExample, type SpatialExampleKind } from "./spatial-example";
import source from "./spatial-example.tsx?raw";
import mediaSource from "./media-examples.tsx?raw";
import modelSource from "./host-model-example.tsx?raw";

const examples = [
  { id: "scene-video", label: "Scene video" },
  { id: "360-video", label: "360 video" },
  { id: "model", label: "Model" },
  { id: "scroll", label: "Scrolling" },
] as const;

const panorama = cubeTileJsx(undefined, "        ");
const videoUrl = "/fixtures/360video/1/video-1024x512.mp4";

const snippets = {
  "scene-video": {
    hooks: "useState",
    imports: "Tile, VideoHotspot, PanoSpatialControls, PanoMediaControls, type PanoMediaController",
    state: `  const [controller, setController] = useState<PanoMediaController | null>(null);
  const [playing, setPlaying] = useState(false);`,
    scene: `${panorama}
        <VideoHotspot ref={setController} id="movie" src="${videoUrl}" position={{ yaw: 0, pitch: 0 }}
          width={28} height={16} playing={playing} onClick={() => setPlaying((value) => !value)}
          onPlaybackStateChange={(state) => setPlaying(state === "playing")} />`,
    controls: `<PanoSpatialControls position={{ yaw: 0, pitch: -12 }} width={28}>
            <PanoMediaControls controller={controller} />
          </PanoSpatialControls>`,
  },
  "360-video": {
    hooks: "useSyncExternalStore",
    imports: "PanoVideo, PanoSpatialControls, PanoMediaControls",
    state: "  const controller = useSyncExternalStore(viewer.subscribeVideo, viewer.getVideo, () => null);",
    scene: `<PanoVideo src="${videoUrl}" loop />`,
    controls: "<PanoSpatialControls><PanoMediaControls controller={controller} /></PanoSpatialControls>",
  },
  model: {
    hooks: "useMemo, useState",
    imports: "Tile, PanoModelControls",
    state: `  const [open, setOpen] = useState(false);
  const [angle, setAngle] = useState(0);
  const [scale, setScale] = useState(1);
  const adapter = useMemo(() => ({
    rotateBy: (yaw: number) => setAngle((angle) => angle + yaw),
    zoomBy: (factor: number) => setScale((scale) => Math.max(0.5, Math.min(2, scale * factor))),
    resetView: () => { setAngle(0); setScale(1); },
  }), []);`,
    scene: panorama,
    controls: `<button type="button" style={{ pointerEvents: "auto" }} onClick={() => setOpen(true)}>Open model</button>
          <PanoDialog title="Model controls" open={open} onOpenChange={setOpen}>
            <div style={{ width: 100, height: 100, margin: 32, background: "teal",
              transform: \`perspective(200px) rotateY(\${angle}deg) scale(\${scale})\` }} />
            <PanoModelControls adapter={adapter} />
          </PanoDialog>`,
  },
  scroll: {
    hooks: "useRef, useState",
    imports: "Tile, PanoScrollControls",
    state: `  const [open, setOpen] = useState(false);
  const article = useRef<HTMLDivElement>(null);`,
    scene: panorama,
    controls: `<button type="button" style={{ pointerEvents: "auto" }} onClick={() => setOpen(true)}>Open article</button>
          <PanoDialog title="Scroll controls" open={open} onOpenChange={setOpen}>
            <div ref={article} tabIndex={0} style={{ height: 160, overflow: "auto" }}>
              {Array.from({ length: 12 }, (_, index) => <p key={index}>Chapter {index + 1}</p>)}
            </div>
            <PanoScrollControls targetRef={article} />
          </PanoDialog>`,
  },
} satisfies Record<SpatialExampleKind, { hooks: string; imports: string; state: string; scene: string; controls: string }>;

function spatialSnippet(kind: SpatialExampleKind) {
  const { hooks, imports, state, scene, controls } = snippets[kind];
  const dialog = kind === "model" || kind === "scroll";
  return `import { ${hooks} } from "react";
import { PanoOverlay, PanoViewer, WebVR, usePanoViewer, ${imports} } from "@ericchen1990/pano-view";
import "@ericchen1990/pano-view/styles.css";
${dialog ? 'import { PanoDialog } from "@ericchen1990/pano-view/ui";\nimport "@ericchen1990/pano-view/ui/styles.css";\n' : ""}
export function SpatialControlsExample() {
  const viewer = usePanoViewer();
${state}

  return (
    <>
      <button type="button" onClick={() => void viewer.toggleVR().catch(console.error)}>Toggle VR</button>
      <PanoViewer ref={viewer.ref} style={{ height: 540 }}>
        <WebVR />
        ${scene}
        <PanoOverlay>
          ${controls}
        </PanoOverlay>
      </PanoViewer>
    </>
  );
}`;
}

export function SpatialControlsPage() {
  const { t } = usePlaygroundLanguage();
  const [kind, setKind] = useState<SpatialExampleKind>("scene-video");
  return (
    <ExamplePage
      eyebrow={t("Immersive")}
      title={t("Spatial controls")}
      description={t("Learn one VR control target at a time: media playback, a host-rendered model, or scrolling content. Gaze until the reticle fills to activate an icon; scrolling continues while you keep looking. Switching examples exits the current session.")}
    >
      <div className={pageControlsClassName}>
        <div className={controlLabelClassName}>{t("Spatial control example")}<div
            className="flex flex-wrap gap-1.5"
            role="group"
            aria-label={t("Spatial control example")}
          >
            {examples.map((example) => (
              <button
                type="button"
                key={example.id}
                aria-pressed={kind === example.id}
                className={cn(
                  segmentedButtonClassName,
                  kind === example.id && segmentedButtonActiveClassName,
                )}
                onClick={() => setKind(example.id)}
              >
                {t(example.label)}
              </button>
            ))}
          </div>
        </div>
      </div>
      <SpatialExample key={kind} kind={kind} />
      <p className="px-6 text-sm text-muted-2">{t("Icon groups appear only in VR. Outside VR, click the scene video or use the 360 player controls; drag the model, scroll to zoom, or focus it and use arrow keys. Open the model/article before entering VR to observe dialog state across entry and exit.")}</p>
      <ExampleCode react={{
        label: examples.find(({ id }) => id === kind)!.label,
        blurb: t("Connect the selected target to its controls inside the viewer."),
        code: spatialSnippet(kind),
      }} />
      <details className="border-t border-line p-5">
        <summary>{t("Complete spatial controls example")}</summary>
        <CodeSnippet
        label={t("Spatial controls: complete integration")}
        blurb={t("The running component mounts only the selected target. PanoOverlay owns the dialog and spatial controls; the media and model implementations are below.")}
        code={source}
        />
      {kind === "scene-video" || kind === "360-video" ? (
        <CodeSnippet
          label={t("Media controllers")}
          blurb={t("VideoHotspot supplies a controller ref; the 360 player supplies its controller through usePanoViewer. Both feed PanoMediaControls inside PanoSpatialControls.")}
          code={mediaSource}
        />
      ) : null}
      {kind === "model" ? (
        <CodeSnippet
          label={t("Host model adapter")}
          blurb={t("The host owns model view state. usePanoSpatialControls connects rotation, zoom and reset to the VR control adapter.")}
          code={modelSource}
        />
      ) : null}
      </details>
    </ExamplePage>
  );
}
