import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import * as Dialog from "@radix-ui/react-dialog";
import {
  AutoRotate, PanoViewer, ProjectScenes, PanoOverlayPortalProvider, loadPanoProject, usePanoModal, usePanoOverlay, usePanoViewer,
  type LoadedPanoProject, type ProjectHotspotDefinition,
} from "@ericchen1990/pano-view";
import {
  PanoDialog, PanoDialogRoot, PanoDialogBackdrop, PanoDialogContent, PanoDialogTitle,
  PanoDialogDescription, PanoDialogClose,
} from "@ericchen1990/pano-view/ui";
import "@ericchen1990/pano-view/ui/styles.css";
import { SiteHeader } from "../SiteHeader";
import { SiteFooter } from "../SiteFooter";
import { CodeSnippet } from "../CodeSnippet";
import { cn } from "../../cn";
import { pageSectionClassName, pageHeadingWrapClassName, pageHeadingTitleClassName, pageHeadingStatusClassName, pageControlsClassName, segmentedButtonClassName, segmentedButtonActiveClassName, shellClassName } from "../../ui";

const CONTENT = { article: "Story", video: "Video", gallery: "Gallery", iframe: "Visitor guide" } as const;
type ContentKind = keyof typeof CONTENT;
type DialogMode = "default" | "composed" | "custom";
const kinds = Object.keys(CONTENT) as ContentKind[];

function Gallery() {
  const [index, setIndex] = useState(0);
  return <figure className="m-0 grid gap-3">
    <img className="block h-auto w-full" src={`/fixtures/panorama/panos/${index + 1}/sphere.webp`} alt={`Panorama ${index + 1}`} />
    <figcaption className="flex items-center justify-between gap-3">
      <button type="button" className={segmentedButtonClassName} onClick={() => setIndex((index + 2) % 3)}>Previous image</button>
      <span aria-live="polite">{index + 1} / 3</span>
      <button type="button" className={segmentedButtonClassName} onClick={() => setIndex((index + 1) % 3)}>Next image</button>
    </figcaption>
  </figure>;
}

function NestedTooltip() {
  const { portalContainer } = usePanoOverlay();
  const [visible, setVisible] = useState(false);
  return <>
    <button type="button" className={segmentedButtonClassName}
      aria-describedby={visible ? "overlay-tip" : undefined}
      onFocus={() => setVisible(true)} onBlur={() => setVisible(false)}
      onPointerEnter={() => setVisible(true)} onPointerLeave={() => setVisible(false)}>
      About this story
    </button>
    {visible && portalContainer ? createPortal(
      <div id="overlay-tip" role="tooltip" className="absolute top-16 right-4 max-w-64 border border-cyan-300 bg-slate-900 p-3 text-sm text-white">
        This tooltip shares the dialog’s fullscreen container.
      </div>, portalContainer) : null}
  </>;
}

function Content({ kind }: { kind: ContentKind }) {
  const [failed, setFailed] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const video = videoRef.current;
    return () => {
      if (!video) return;
      video.pause();
    };
  }, []);
  if (failed) return <p role="alert">This media could not be loaded. Close and reopen to try again.</p>;
  if (kind === "video") return <video ref={videoRef} className="block h-auto w-full" controls playsInline preload="metadata" src="/fixtures/hotspots/loop.webm" onError={() => setFailed(true)} />;
  if (kind === "gallery") return <Gallery />;
  if (kind === "iframe") return <iframe className="block h-80 w-full border-0" title="Visitor guide" src="/fixtures/hotspots/embed.html" sandbox="allow-same-origin" />;
  return <article className="grid gap-4 text-sm leading-7">
    <img className="block h-auto w-full" src="/fixtures/hotspots/gallery-card.svg" alt="A panorama visitor card" />
    <p>Every place has a story. Open a marker to explore images, watch a clip, or browse a visitor guide without leaving the panorama.</p>
    <label className="grid gap-2">Your notes
      <input className="rounded border border-slate-500 bg-slate-900 p-2 text-white" placeholder="Keep a note while switching fullscreen" />
    </label>
    <NestedTooltip />
    {Array.from({ length: 4 }, (_, index) => <p key={index}>Look around the courtyard, then follow the path into the next room. The landscape, architecture and small details each offer another way to explore this space.</p>)}
  </article>;
}

function CustomDialog({ open, onOpenChange, title, children }: { open: boolean; onOpenChange: (open: boolean) => void; title: string; children: ReactNode }) {
  const { portalContainer, visibleRect } = usePanoOverlay();
  const [nestedContainer, setNestedContainer] = useState<HTMLDivElement | null>(null);
  const restoreFocus = useRef<HTMLElement | null>(null);
  usePanoModal(open);
  return <Dialog.Root open={open} onOpenChange={onOpenChange}>
    {portalContainer ? <Dialog.Portal container={portalContainer}>
      <Dialog.Overlay className="absolute inset-0 bg-black/70" style={{ pointerEvents: "auto" }} />
      <Dialog.Content
        aria-describedby={undefined}
        className="absolute top-1/2 left-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden border-2 border-cyan-300 bg-slate-950 text-slate-100"
        style={{ left: visibleRect.left + visibleRect.width / 2, top: visibleRect.top + visibleRect.height / 2, width: Math.min(720, Math.max(0, visibleRect.width - 32)), maxHeight: Math.max(0, visibleRect.height - 32), pointerEvents: "auto" }}
        onOpenAutoFocus={() => { restoreFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null; }}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          const target = restoreFocus.current?.isConnected ? restoreFocus.current : portalContainer.closest("[data-pano-viewer]")?.querySelector("canvas");
          target?.focus({ preventScroll: true });
        }}>
        <header className="flex shrink-0 items-center justify-between gap-4 border-b border-cyan-300 p-4">
          <Dialog.Title className="m-0 text-lg">{title}</Dialog.Title>
          <Dialog.Close className={segmentedButtonClassName}>Close</Dialog.Close>
        </header>
        <PanoOverlayPortalProvider container={nestedContainer}>
          <div className="min-h-0 overflow-auto p-4">{children}</div>
        </PanoOverlayPortalProvider>
        <div ref={setNestedContainer} data-custom-dialog-portals="" className="pointer-events-none absolute inset-0 z-10" />
      </Dialog.Content>
    </Dialog.Portal> : null}
  </Dialog.Root>;
}

function OverlayDialogs({ mode, selected, onClose, toggleFullscreen }: { mode: DialogMode; selected: ContentKind | null; onClose: () => void; toggleFullscreen: () => void }) {
  const { isFullscreen } = usePanoOverlay();
  const open = selected !== null;
  const title = selected ? CONTENT[selected] : "Hotspot content";
  const content = selected ? <>
    <button type="button" className={cn(segmentedButtonClassName, "mb-4")} onClick={toggleFullscreen}>{isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}</button>
    <Content key={selected} kind={selected} />
  </> : null;
  const onOpenChange = (next: boolean) => { if (!next) onClose(); };
  if (mode === "custom") return <CustomDialog open={open} onOpenChange={onOpenChange} title={title}>
    {content}
  </CustomDialog>;
  if (mode === "composed") return <PanoDialogRoot open={open} onOpenChange={onOpenChange}>
    <PanoDialogBackdrop style={{ background: "rgb(8 25 29 / 85%)" }} />
    <PanoDialogContent style={{ borderRadius: 0, border: "2px solid #df6b42", overflow: "hidden" }}>
      <header className="flex shrink-0 items-center justify-between gap-4 border-b border-orange-400 p-4">
        <div><PanoDialogTitle className="m-0 text-xl">{title}</PanoDialogTitle>
          <PanoDialogDescription className="m-0 text-sm text-slate-300">A custom header built from dialog parts.</PanoDialogDescription></div>
        <PanoDialogClose className={segmentedButtonClassName}>Close</PanoDialogClose>
      </header>
      <div className="min-h-0 overflow-auto p-4">{content}</div>
    </PanoDialogContent>
  </PanoDialogRoot>;
  return <PanoDialog open={open} onOpenChange={onOpenChange} title={title} description="Explore this hotspot without leaving the panorama.">{content}</PanoDialog>;
}

export function OverlayPage() {
  const viewer = usePanoViewer();
  const [mode, setMode] = useState<DialogMode>("default");
  const [selected, setSelected] = useState<ContentKind | null>(() => new URLSearchParams(window.location.search).has("initialOpen") ? "article" : null);
  const [project, setProject] = useState<LoadedPanoProject>();
  const [error, setError] = useState<string>();
  const [autoRotate, setAutoRotate] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    loadPanoProject("/fixtures/projects/tour/project.json", { requestInit: { signal: controller.signal } })
      .then((loaded) => {
        if (controller.signal.aborted) return;
        setProject({ ...loaded, scenes: loaded.scenes.map((entry) => ({ ...entry,
          hotspots: kinds.map((id, index): ProjectHotspotDefinition => ({
            type: "graphic", id, label: CONTENT[id], position: { yaw: (index - 1.5) * 17, pitch: 0 }, width: 7, height: 7,
            graphic: { kind: "circle", fill: "#df6b42", stroke: "#ffffff", strokeWidth: 3 }, tooltip: CONTENT[id],
          })),
        })) });
      }).catch((cause: unknown) => { if (!controller.signal.aborted) setError(String(cause)); });
    return () => controller.abort();
  }, []);

  return <main className={shellClassName}>
    <SiteHeader />
    <section className={cn(pageSectionClassName, "mt-8")} aria-labelledby="overlay-title">
      <div className={pageHeadingWrapClassName}>
        <h1 className={pageHeadingTitleClassName} id="overlay-title">Hotspot stories</h1>
        <p className={pageHeadingStatusClassName}>Choose a marker, or open its content below. Try the same dialog in fullscreen.</p>
      </div>
      <div className={pageControlsClassName} role="group" aria-label="Dialog implementation">
        {(["default", "composed", "custom"] as const).map((value) => <button key={value} type="button" className={cn(segmentedButtonClassName, mode === value && segmentedButtonActiveClassName)} aria-pressed={mode === value} onClick={() => setMode(value)}>
          {{ default: "Default dialog", composed: "Compose parts", custom: "Third-party dialog" }[value]}
        </button>)}
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={autoRotate} onChange={(event) => setAutoRotate(event.target.checked)} />Auto rotate</label>
      </div>
      <PanoViewer ref={viewer.ref} aria-label="Hotspot stories viewer" style={{ height: 560 }}
        renderOverlay={({ isFullscreen }) => <>
          <div className="absolute right-4 bottom-4 left-4 flex flex-wrap justify-center gap-2" style={{ pointerEvents: "auto" }}>
            {kinds.map((kind) => <button type="button" className={segmentedButtonClassName} key={kind} onClick={() => setSelected(kind)}>Open {CONTENT[kind]}</button>)}
            <button type="button" className={segmentedButtonClassName} onClick={() => void viewer.toggleFullscreen()}>{isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}</button>
            <button type="button" className={segmentedButtonClassName} disabled={!project} onClick={() => { setSelected(null); viewer.nextScene(); }}>Next scene</button>
          </div>
          <OverlayDialogs mode={mode} selected={selected} onClose={() => setSelected(null)} toggleFullscreen={() => void viewer.toggleFullscreen()} />
        </>}>
        <AutoRotate enabled={autoRotate} speed={8} />
        {project ? <ProjectScenes project={project} transition="dissolve" onActiveSceneIdChange={() => setSelected(null)}
          onHotspotClick={(event) => {
            event.preventDefault();
            if (event.hotspot.id in CONTENT) setSelected(event.hotspot.id as ContentKind);
          }} /> : null}
      </PanoViewer>
      {error ? <p role="alert" className="p-4">{error}</p> : null}
      <CodeSnippet label="Fullscreen-safe content" blurb="Keep content in the DOM overlay and let your application choose what a hotspot opens."
        code={`import { PanoDialog } from "@ericchen1990/pano-view/ui";\nimport "@ericchen1990/pano-view/ui/styles.css";\n\n<PanoViewer renderOverlay={() => (\n  <PanoDialog open={selected !== null} onOpenChange={(open) => {\n    if (!open) setSelected(null);\n  }} title="Hotspot story">\n    <MyContent hotspot={selected} />\n  </PanoDialog>\n)}>\n  <ProjectScenes project={project} onHotspotClick={(event) => {\n    event.preventDefault();\n    setSelected(event.hotspot);\n  }} />\n</PanoViewer>`} />
    </section>
    <SiteFooter label="@ericchen1990/pano-view · overlays" />
  </main>;
}
