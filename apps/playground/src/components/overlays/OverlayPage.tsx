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
import { POPUPS_BY_SCENE, type PopupSelection } from "./multi-hotspot-example";
import multiHotspotCode from "./multi-hotspot-example.tsx?raw";
import { cn } from "../../cn";
import { pageSectionClassName, pageHeadingWrapClassName, pageHeadingTitleClassName, pageHeadingStatusClassName, pageControlsClassName, segmentedButtonClassName, segmentedButtonActiveClassName, shellClassName } from "../../ui";

type DialogMode = "default" | "composed" | "custom";

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

function OverlayDialogs({ mode, selected, onClose }: { mode: DialogMode; selected: PopupSelection | null; onClose: () => void }) {
  const popup = selected ? POPUPS_BY_SCENE[selected.sceneId]?.[selected.hotspotId] : undefined;
  const open = popup !== undefined;
  const title = popup?.title ?? "Hotspot content";
  const content = popup && selected ? <div key={JSON.stringify([selected.sceneId, selected.hotspotId])}>
    {popup.body}
    {popup.kind === "article" ? <NestedTooltip /> : null}
  </div> : null;
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
  const [selected, setSelected] = useState<PopupSelection | null>(() => new URLSearchParams(window.location.search).has("initialOpen") ? { sceneId: "entrance", hotspotId: "story" } : null);
  const [activeSceneId, setActiveSceneId] = useState("entrance");
  const [project, setProject] = useState<LoadedPanoProject>();
  const [error, setError] = useState<string>();
  const [autoRotate, setAutoRotate] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    loadPanoProject("/fixtures/projects/tour/project.json", { requestInit: { signal: controller.signal } })
      .then((loaded) => {
        if (controller.signal.aborted) return;
        setActiveSceneId(loaded.initialSceneId);
        setProject({ ...loaded, scenes: loaded.scenes.map((entry) => ({ ...entry,
          hotspots: [
            ...Object.entries(POPUPS_BY_SCENE[entry.scene.id] ?? {}).flatMap(([id, popup], index): ProjectHotspotDefinition[] => popup ? [{
              type: "graphic", id, label: popup.title, position: { yaw: (index - 2) * 14, pitch: 0 }, width: 7, height: 7,
              graphic: { kind: "circle", fill: "#df6b42", stroke: "#ffffff", strokeWidth: 3 }, tooltip: popup.title,
            }] : []),
            {
              type: "graphic", id: "next-room", label: "Go to next room", position: { yaw: 0, pitch: -18 }, width: 7, height: 7,
              graphic: { kind: "arrow", fill: "#67e8f9" }, tooltip: "Go to next room",
              action: { type: "scene", sceneId: entry.scene.id === "entrance" ? "hall" : "entrance" },
            },
          ],
        })) });
      }).catch((cause: unknown) => { if (!controller.signal.aborted) setError(String(cause)); });
    return () => controller.abort();
  }, []);

  return <main className={shellClassName}>
    <SiteHeader />
    <section className={cn(pageSectionClassName, "mt-8")} aria-labelledby="overlay-title">
      <div className={pageHeadingWrapClassName}>
        <h1 className={pageHeadingTitleClassName} id="overlay-title">Hotspot stories</h1>
        <p className={pageHeadingStatusClassName}>Five hotspots open five different pieces of content in one shared dialog. The scene arrow keeps its default navigation.</p>
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
            {Object.entries(POPUPS_BY_SCENE[activeSceneId] ?? {}).map(([hotspotId, popup]) => popup ? <button type="button" className={segmentedButtonClassName} key={hotspotId} onClick={() => setSelected({ sceneId: activeSceneId, hotspotId })}>Open {popup.title}</button> : null)}
            <button type="button" className={segmentedButtonClassName} onClick={() => void viewer.toggleFullscreen()}>{isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}</button>
            <button type="button" className={segmentedButtonClassName} disabled={!project} onClick={() => { setSelected(null); viewer.nextScene(); }}>Next scene</button>
          </div>
          <OverlayDialogs mode={mode} selected={selected} onClose={() => setSelected(null)} />
        </>}>
        <AutoRotate enabled={autoRotate} speed={8} />
        {project ? <ProjectScenes project={project} activeSceneId={activeSceneId} transition="dissolve" onActiveSceneIdChange={(id) => { setActiveSceneId(id); setSelected(null); }}
          onHotspotClick={(event) => {
            const popup = POPUPS_BY_SCENE[event.sceneId]?.[event.hotspot.id];
            if (!popup) return;
            event.preventDefault();
            setSelected({ sceneId: event.sceneId, hotspotId: event.hotspot.id });
          }} /> : null}
      </PanoViewer>
      {error ? <p role="alert" className="p-4">{error}</p> : null}
      <section aria-labelledby="hotspot-mapping-title" className="overflow-x-auto border-t border-[#244047] p-5">
        <h2 id="hotspot-mapping-title" className="m-0 text-lg font-semibold">Hotspot → content</h2>
        <p className="my-3 text-sm text-slate-300" aria-live="polite">Scene: {activeSceneId}. Both scenes reuse these IDs with their own titles and content. Close the dialog before choosing another marker.</p>
        <table className="w-full text-left text-sm">
          <thead><tr><th className="p-2">Hotspot ID</th><th className="p-2">Content type</th><th className="p-2">Dialog title</th></tr></thead>
          <tbody>{Object.entries(POPUPS_BY_SCENE[activeSceneId] ?? {}).map(([id, popup]) => popup ? <tr key={id} className="border-t border-[#244047]"><td className="p-2 font-mono">{id}</td><td className="p-2">{popup.kind}</td><td className="p-2">{popup.title}</td></tr> : null)}</tbody>
        </table>
      </section>
      <CodeSnippet label="Multiple hotspots → one dialog" blurb="Look up content by scene ID and hotspot ID, then update the shared dialog’s title and body. The full example below is also used by this demo."
        code={multiHotspotCode} />
    </section>
    <SiteFooter label="@ericchen1990/pano-view · overlays" />
  </main>;
}
