# Dialogs and custom overlay styling

**English** | [简体中文](./dialogs.zh-CN.md) · [Component reference](../README.md#dom-overlays-and-dialogs)

This guide covers hotspot dialogs with text/images, video, galleries and iframes. The viewer owns the fullscreen-safe mount point; your application owns the selected hotspot, dialog content and styling. The examples use the current Overlay API and the optional `@ericchen1990/pano-view/ui` entry. Run `pnpm dev` in this repository and open `/overlays` to try the three integration styles.

## Contents

- [Choose an approach](#choose-an-approach)
- [Quick start](#quick-start)
- [Choose content by hotspot](#choose-content-by-hotspot)
- [Customize the default appearance](#customize-the-default-appearance)
- [Compose a different layout](#compose-a-different-layout)
- [Use an existing Dialog](#use-an-existing-dialog)
- [Nested portals](#nested-portals)
- [Fullscreen and lifecycle](#fullscreen-and-lifecycle)
- [API reference](#api-reference)
- [Troubleshooting](#troubleshooting)

<a id="choose-an-approach"></a>
## Choose an approach

| Need | Approach | What you own |
| --- | --- | --- |
| A working modal with minor theme changes | `PanoDialog` + CSS variables | Open state and content |
| Different header, close button, footer or layout | Compose the `PanoDialog*` parts | Markup, styling and content |
| An existing Dialog / design system | `renderOverlay` + `usePanoOverlay` + `usePanoModal` | Dialog implementation, accessibility and styling |

The default and composed dialogs handle focus, backdrop dismissal, Escape and viewer input locking. A third-party dialog keeps its own accessibility behavior; `usePanoModal` only coordinates viewer input. None of these approaches changes hotspot definitions or project JSON.

<a id="quick-start"></a>
## Quick start

Install the viewer and its existing peer dependencies as described in [Install](../README.md#install). Import the viewer stylesheet once. Import the separate UI stylesheet when you want the default dialog appearance:

```tsx
import { useState } from "react";
import {
  PanoViewer,
  ProjectScenes,
  usePanoViewer,
  type LoadedPanoProject,
  type ProjectHotspotDefinition,
} from "@ericchen1990/pano-view";
import { PanoDialog } from "@ericchen1990/pano-view/ui";
import "@ericchen1990/pano-view/styles.css";
import "@ericchen1990/pano-view/ui/styles.css";
import "./tour.css";

export function Tour({ project }: { project: LoadedPanoProject }) {
  const viewer = usePanoViewer();
  const [selected, setSelected] = useState<ProjectHotspotDefinition | null>(null);

  return (
    <PanoViewer
      ref={viewer.ref}
      className="my-tour"
      style={{ height: 560 }}
      renderOverlay={({ isFullscreen }) => (
        <>
          <button
            type="button"
            style={{ position: "absolute", right: 16, bottom: 16, pointerEvents: "auto" }}
            onClick={() => void viewer.toggleFullscreen()}
          >
            {isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
          </button>
          <PanoDialog
            open={selected !== null}
            onOpenChange={(open) => { if (!open) setSelected(null); }}
            title={selected?.label ?? "Details"}
            description="Discover more about this place."
            closeLabel="Close details"
          >
            {selected ? <p key={selected.id}>Content for {selected.label ?? selected.id}</p> : null}
          </PanoDialog>
        </>
      )}
    >
      <ProjectScenes
        project={project}
        onHotspotClick={(event) => {
          if (event.hotspot.id !== "details") return;
          event.preventDefault();
          setSelected(event.hotspot);
        }}
        onActiveSceneIdChange={() => setSelected(null)}
      />
    </PanoViewer>
  );
}
```

Supply a loaded project containing a hotspot with ID `details`; see [Static projects and JSON data](../README.md#static-projects-and-json-data) for `loadPanoProject`. Adapt the selection condition to your content mapping. Only call `preventDefault()` when handling a hotspot yourself: other hotspots retain their normal scene navigation or media playback. The example explicitly closes the dialog on scene changes; the library does not impose that policy.

`PanoViewer.children` is the Three.js scene tree. Put ordinary DOM dialogs in `renderOverlay`, not beside `Sphere` or `ProjectScenes` in that tree. Keep the returned component tree stable when `isFullscreen` changes; a key based on fullscreen state would reset its content.

For multiple hotspots, continue with the [complete mapping example below](#choose-content-by-hotspot): it reuses one dialog for five pieces of content and includes the matching project JSON.

<a id="choose-content-by-hotspot"></a>
## Choose content by hotspot

A hotspot's marker type describes its appearance in the panorama. Its ID chooses application-owned popup content. **One `PanoDialog` is a reusable shell: its title and body change with the selected hotspot.** The dialog shows one selection at a time; close it before choosing another background marker.

### Complete example: five hotspots, five pieces of content

The registry below contains two different articles, a video, a gallery and an iframe for each scene. Both scenes deliberately reuse the same hotspot IDs. The lookup therefore uses both `sceneId` and `hotspot.id`, not the marker type or content kind.

| Scene | Hotspot ID | Popup kind | Dialog title |
| --- | --- | --- | --- |
| `entrance` | `story` | article | Courtyard story |
| `entrance` | `details` | article | Garden details |
| `entrance` | `clip` | video | Courtyard video |
| `entrance` | `photos` | gallery | Courtyard gallery |
| `entrance` | `guide` | iframe | Courtyard guide |
| `hall` | `story` | article | Hall story |

The complete source defines every content component, the registry, selection state and click handler. It is also the source displayed in the `/overlays` playground. Save it as `multi-hotspot-example.tsx`, pass a loaded project as `project`, and replace the `/fixtures/...` URLs with your own assets outside this repository.

```tsx
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  PanoViewer,
  ProjectScenes,
  type LoadedPanoProject,
} from "@ericchen1990/pano-view";
import { PanoDialog } from "@ericchen1990/pano-view/ui";
import "@ericchen1990/pano-view/styles.css";
import "@ericchen1990/pano-view/ui/styles.css";

function Story({ image, text }: { image: number; text: string }) {
  return <article style={{ display: "grid", gap: 16 }}>
    <img src={`/fixtures/panorama/panos/${image}/sphere.webp`} alt={text}
      style={{ display: "block", width: "100%", height: "auto" }} />
    <p>{text}</p>
    <label style={{ display: "grid", gap: 8 }}>Your notes
      <input placeholder="Keep a note while switching fullscreen"
        style={{ padding: 8, border: "1px solid currentColor", background: "transparent", color: "inherit" }} />
    </label>
  </article>;
}

function Movie({ src }: { src: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const video = ref.current;
    return () => { video?.pause(); };
  }, []);
  if (failed) return <p role="alert">This video could not be loaded. Close and reopen to try again.</p>;
  return <video ref={ref} src={src} controls playsInline preload="metadata"
    onError={() => setFailed(true)} style={{ display: "block", width: "100%" }} />;
}

function Gallery({ images }: { images: number[] }) {
  const [index, setIndex] = useState(0);
  if (!images.length) return <p>No images available.</p>;
  return <figure style={{ margin: 0 }}>
    <img src={`/fixtures/panorama/panos/${images[index % images.length]}/sphere.webp`}
      alt={`Panorama ${images[index % images.length]}`}
      style={{ display: "block", width: "100%", height: "auto" }} />
    <figcaption style={{ display: "flex", justifyContent: "space-between", gap: 12, marginTop: 12 }}>
      <button type="button" onClick={() => setIndex((index + images.length - 1) % images.length)}>Previous image</button>
      <span aria-live="polite">{index % images.length + 1} / {images.length}</span>
      <button type="button" onClick={() => setIndex((index + 1) % images.length)}>Next image</button>
    </figcaption>
  </figure>;
}

type PopupDefinition = {
  kind: "article" | "video" | "gallery" | "iframe";
  title: string;
  body: ReactNode;
};
export type PopupSelection = { sceneId: string; hotspotId: string };

// Application content, separate from the marker's type and project JSON.
export const POPUPS_BY_SCENE: Partial<Record<string, Partial<Record<string, PopupDefinition>>>> = {
  entrance: {
    story: { kind: "article", title: "Courtyard story", body: <Story image={1} text="The courtyard opens onto a quiet garden and a path beside the water." /> },
    details: { kind: "article", title: "Garden details", body: <Story image={2} text="Explore the planting, stone paths and small details around the garden." /> },
    clip: { kind: "video", title: "Courtyard video", body: <Movie src="/fixtures/hotspots/loop.webm" /> },
    photos: { kind: "gallery", title: "Courtyard gallery", body: <Gallery images={[1, 2, 3]} /> },
    guide: { kind: "iframe", title: "Courtyard guide", body: <iframe title="Courtyard visitor guide" src="/fixtures/hotspots/embed.html" sandbox="allow-same-origin" style={{ width: "100%", height: 320, border: 0 }} /> },
  },
  hall: {
    story: { kind: "article", title: "Hall story", body: <Story image={3} text="Inside the hall, follow the architecture and the view toward the next room." /> },
    details: { kind: "article", title: "Hall details", body: <Story image={1} text="Discover how the hall connects the building to its surrounding landscape." /> },
    clip: { kind: "video", title: "Hall video", body: <Movie src="/fixtures/hotspots/loop.webm" /> },
    photos: { kind: "gallery", title: "Hall gallery", body: <Gallery images={[3, 1, 2]} /> },
    guide: { kind: "iframe", title: "Hall guide", body: <iframe title="Hall visitor guide" src="/fixtures/hotspots/embed.html" sandbox="allow-same-origin" style={{ width: "100%", height: 320, border: 0 }} /> },
  },
};

// The project must contain these hotspot IDs in entrance / hall.
export function MultiHotspotTour({ project }: { project: LoadedPanoProject }) {
  const [selected, setSelected] = useState<PopupSelection | null>(null);
  const popup = selected ? POPUPS_BY_SCENE[selected.sceneId]?.[selected.hotspotId] : undefined;
  const contentKey = selected ? JSON.stringify([selected.sceneId, selected.hotspotId]) : "closed";

  return (
    <PanoViewer style={{ height: 560 }} renderOverlay={() => (
      <PanoDialog
        open={popup !== undefined}
        onOpenChange={(open) => { if (!open) setSelected(null); }}
        title={popup?.title ?? "Hotspot content"}
      >
        {popup ? <div key={contentKey}>{popup.body}</div> : null}
      </PanoDialog>
    )}>
      <ProjectScenes
        project={project}
        onHotspotClick={(event) => {
          const mapped = POPUPS_BY_SCENE[event.sceneId]?.[event.hotspot.id];
          if (!mapped) return; // Keep default navigation/playback for unmapped hotspots.
          event.preventDefault();
          setSelected({ sceneId: event.sceneId, hotspotId: event.hotspot.id });
        }}
        onActiveSceneIdChange={() => setSelected(null)}
      />
    </PanoViewer>
  );
}
```

### Register the corresponding markers in the project

The mapping does not create markers. The project's scene IDs and hotspot IDs must match its keys. Here is a complete project structure for the example; place each generated `viewer.json` and its assets under the referenced scene directory, then load the project with `loadPanoProject` as described in [Static projects and JSON data](../README.md#static-projects-and-json-data).

```json
{
  "schemaVersion": 1,
  "initialSceneId": "entrance",
  "scenes": [
    {
      "id": "entrance",
      "source": {"viewerUrl": "entrance/viewer.json"},
      "hotspots": [
        {"id":"story","type":"graphic","label":"story","position":{"yaw":-28,"pitch":0},"width":7,"height":7,"graphic":{"kind":"circle","fill":"#df6b42"}},
        {"id":"details","type":"graphic","label":"details","position":{"yaw":-14,"pitch":0},"width":7,"height":7,"graphic":{"kind":"circle","fill":"#df6b42"}},
        {"id":"clip","type":"graphic","label":"clip","position":{"yaw":0,"pitch":0},"width":7,"height":7,"graphic":{"kind":"circle","fill":"#df6b42"}},
        {"id":"photos","type":"graphic","label":"photos","position":{"yaw":14,"pitch":0},"width":7,"height":7,"graphic":{"kind":"circle","fill":"#df6b42"}},
        {"id":"guide","type":"graphic","label":"guide","position":{"yaw":28,"pitch":0},"width":7,"height":7,"graphic":{"kind":"circle","fill":"#df6b42"}},
        {"id":"next-room","type":"graphic","label":"Go to next room","position":{"yaw":0,"pitch":-18},"width":7,"height":7,"graphic":{"kind":"arrow","fill":"#67e8f9"},"action":{"type":"scene","sceneId":"hall"}}
      ]
    },
    {
      "id": "hall",
      "source": {"viewerUrl": "hall/viewer.json"},
      "hotspots": [
        {"id":"story","type":"graphic","label":"story","position":{"yaw":-28,"pitch":0},"width":7,"height":7,"graphic":{"kind":"circle","fill":"#df6b42"}},
        {"id":"details","type":"graphic","label":"details","position":{"yaw":-14,"pitch":0},"width":7,"height":7,"graphic":{"kind":"circle","fill":"#df6b42"}},
        {"id":"clip","type":"graphic","label":"clip","position":{"yaw":0,"pitch":0},"width":7,"height":7,"graphic":{"kind":"circle","fill":"#df6b42"}},
        {"id":"photos","type":"graphic","label":"photos","position":{"yaw":14,"pitch":0},"width":7,"height":7,"graphic":{"kind":"circle","fill":"#df6b42"}},
        {"id":"guide","type":"graphic","label":"guide","position":{"yaw":28,"pitch":0},"width":7,"height":7,"graphic":{"kind":"circle","fill":"#df6b42"}},
        {"id":"next-room","type":"graphic","label":"Go to next room","position":{"yaw":0,"pitch":-18},"width":7,"height":7,"graphic":{"kind":"arrow","fill":"#67e8f9"},"action":{"type":"scene","sceneId":"entrance"}}
      ]
    }
  ]
}
```

All these markers use `type: "graphic"`. The `kind` field in `POPUPS_BY_SCENE` is application metadata for the content/mapping table, not a new hotspot type or a field to add to project JSON. The two article entries have different text and images despite sharing the same content kind.

### What happens after a click

1. `onHotspotClick` supplies the scene ID and hotspot ID. `POPUPS_BY_SCENE[event.sceneId]?.[event.hotspot.id]` finds its content definition.
2. If no definition exists, the handler returns without `preventDefault()`. The `next-room` marker therefore keeps its normal scene navigation; other unmapped media markers keep their default playback behavior.
3. If a definition exists, `preventDefault()` suppresses that marker's default action, and `setSelected` stores only `{ sceneId, hotspotId }`.
4. The next render derives `popup` from that selection. The same `PanoDialog` receives `popup.title` and `popup.body`, so there is no separate modal instance per marker.
5. The content wrapper's key includes both IDs. Direct programmatic selection changes reset the previous content's form/gallery state and run its cleanup, including pausing the old video. The outer dialog and its focus boundary remain shared.
6. Closing or changing scenes clears `selected`, unmounts the content and releases the modal lock. Fullscreen changes do not alter the selection key, so they do not reset the content.

In `/overlays`, open **Courtyard story** and **Garden details** to compare two articles, then try video, gallery and guide. Use **Go to next room** to enter the hall; the `story` ID now opens **Hall story** with different content. The mapping table below the viewer and the copyable code show the exact relationship.

`body` accepts any React node: native media, a business component, rich text, or a component that fetches API data. Handle loading/errors in that component and dispose custom players/subscriptions in cleanup. If the content comes from JSON, map a validated content kind to a React renderer rather than putting React nodes in JSON. Configure iframe permissions for the embed; third-party response headers can reject embedding. Video autoplay remains opt-in and subject to browser policy.

<a id="customize-the-default-appearance"></a>
## Customize the default appearance

### 1. Theme the entire viewer with CSS variables

Use the `my-tour` class from the quick start. Place this CSS in `tour.css`, loaded after the default UI stylesheet:

```css
.my-tour {
  --pano-dialog-width: 760px;
  --pano-dialog-background: #ffffff;
  --pano-dialog-color: #17212b;
  --pano-dialog-backdrop: rgb(0 0 0 / 55%);
  --pano-dialog-border: 1px solid #d0d7de;
  --pano-dialog-radius: 16px;
  --pano-dialog-shadow: 0 20px 64px rgb(0 0 0 / 25%);
  --pano-dialog-padding: 24px;
  --pano-dialog-muted-color: #52616f;
  --pano-dialog-focus-color: #005fcc;
}
```

The variables inherit into all dialogs and their backdrops in this viewer, including in fullscreen. Separate viewer classes can use separate themes.

| Variable | Default | Affects |
| --- | --- | --- |
| `--pano-dialog-width` | `640px` | Preferred content width, capped by visible space |
| `--pano-dialog-background` | `#161b22` | Content background |
| `--pano-dialog-color` | `#f4f4f4` | Content and close button text |
| `--pano-dialog-backdrop` | `rgb(0 0 0 / 65%)` | Backdrop background |
| `--pano-dialog-border` | `1px solid #39424e` | Content border |
| `--pano-dialog-radius` | `12px` | Content corners |
| `--pano-dialog-shadow` | `0 16px 64px rgb(0 0 0 / 45%)` | Content shadow |
| `--pano-dialog-padding` | `20px` | Header/body spacing and close button top/right inset |
| `--pano-dialog-muted-color` | `#a7b4c4` | Description text |
| `--pano-dialog-focus-color` | `#ffb300` | Default close button focus outline |

`--pano-dialog-width` works without the optional stylesheet because the content's structural layout reads it. The remaining appearance variables require that stylesheet. `--pano-dialog-available-width` and `--pano-dialog-available-height` are calculated by the component; use the preferred width variable rather than overriding these measurements.

**Variable placement matters.** `PanoDialog.className` and `PanoDialog.style` apply to Content. Backdrop is a sibling, so `style={{ "--pano-dialog-backdrop": "..." }}` on Content cannot theme it. Set backdrop variables on the viewer/ancestor, or compose `PanoDialogBackdrop` with its own `style`.

### 2. Style one dialog with a class or inline styles

`className` targets the panel; descendants can be styled through the shipped class names:

```css
.my-dialog .pano-dialog-title { font-size: 1.4rem; }
.my-dialog .pano-dialog-description { line-height: 1.6; }
.my-dialog .pano-dialog-body { line-height: 1.7; }
.my-dialog .pano-dialog-close { color: #b42318; }
```

Use a typed CSS custom property in TypeScript when the style is dynamic:

```tsx
import type { CSSProperties } from "react";
import { PanoDialog, type PanoDialogProps } from "@ericchen1990/pano-view/ui";

const style: CSSProperties & { "--pano-dialog-width": string } = {
  "--pano-dialog-width": "720px",
  background: "#fff",
  color: "#17212b",
  borderRadius: 8,
};

// Render this component inside PanoViewer.renderOverlay.
export function StyledDialog(props: PanoDialogProps) {
  return <PanoDialog {...props} className="my-dialog" style={style} />;
}
```

The default panel has inline structural styles for positioning, width, maximum height, flex layout, overflow and pointer events. A normal CSS width rule cannot override its inline width; use `--pano-dialog-width`. For other structural changes, pass an explicit `style` while preserving visible-space bounds, or compose the parts. CSS Modules can target descendants with selectors such as `.dialog :global(.pano-dialog-title)`; put inherited theme variables on the viewer's module class.

| Default selector | Meaning |
| --- | --- |
| `.pano-dialog-backdrop` | Backdrop, outside Content |
| `.pano-dialog-content` | Content panel; receives `PanoDialog.className` and `style` |
| `.pano-dialog-header` | Default title/description wrapper |
| `.pano-dialog-title` | Title |
| `.pano-dialog-description` | Optional description |
| `.pano-dialog-close` | Default 36×36 close button with centered SVG |
| `.pano-dialog-body` | Scrollable default content area |

<a id="compose-a-different-layout"></a>
## Compose a different layout

Use parts when you need a footer, a different close control, or full ownership of the markup. This example supplies its own visual CSS and does not need `ui/styles.css`. Render `CustomLayoutDialog` from `renderOverlay` and pass the desired state and content.

```tsx
import type { ReactNode } from "react";
import {
  PanoDialogRoot, PanoDialogBackdrop, PanoDialogContent,
  PanoDialogTitle, PanoDialogDescription, PanoDialogClose,
} from "@ericchen1990/pano-view/ui";

export function CustomLayoutDialog({ open, onOpenChange, children }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
}) {
  return (
    <PanoDialogRoot open={open} onOpenChange={onOpenChange}>
      <PanoDialogBackdrop style={{ background: "rgb(0 0 0 / 60%)" }} />
      <PanoDialogContent className="custom-panel" style={{ overflow: "hidden" }}>
        <header className="custom-header">
          <div>
            <PanoDialogTitle className="custom-title">Visitor guide</PanoDialogTitle>
            <PanoDialogDescription className="custom-description">Explore this location.</PanoDialogDescription>
          </div>
          <PanoDialogClose className="custom-close" type="button" aria-label="Close guide">Close</PanoDialogClose>
        </header>
        <div className="custom-body">{children}</div>
        <footer className="custom-footer">
          <PanoDialogClose className="custom-close" type="button">Done</PanoDialogClose>
        </footer>
      </PanoDialogContent>
    </PanoDialogRoot>
  );
}
```

```css
.custom-panel.pano-dialog-content {
  background: #fff;
  color: #17212b;
  border: 1px solid #d0d7de;
  border-radius: 12px;
}
.custom-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 20px;
  flex-shrink: 0;
}
.custom-title { margin: 0; font-size: 1.25rem; }
.custom-description { margin: 8px 0 0; color: #52616f; }
.custom-body { min-height: 0; overflow: auto; padding: 0 20px 20px; }
.custom-footer { flex-shrink: 0; padding: 16px 20px; border-top: 1px solid #d0d7de; }
.custom-close { padding: 8px 12px; color: inherit; background: transparent; border: 1px solid currentColor; border-radius: 6px; cursor: pointer; }
.custom-close:focus-visible { outline: 2px solid #005fcc; outline-offset: 2px; }
```

Root already acquires the viewer modal lock; do not call `usePanoModal` again for it. Backdrop and Content each create their own Portal into the viewer; do not wrap them in another Portal. Content retains its measured positioning and nested portal target. It deliberately excludes `asChild` and `forceMount`; Title, Description and Close keep their Radix composition props. Always supply Title. If there is no description, omit Description and pass `aria-describedby={undefined}` to Content.

To prevent Escape dismissal or outside dismissal, use Content's `onEscapeKeyDown` or `onInteractOutside` and call `event.preventDefault()` for the behavior you want to suppress. Keep a usable Close control. For custom initial/return focus, use `onOpenAutoFocus` / `onCloseAutoFocus`; calling `preventDefault()` transfers focus handling to you. These advanced hooks are on `PanoDialogContent`, not on the convenience `PanoDialog`.

<a id="use-an-existing-dialog"></a>
## Use an existing Dialog

The viewer does not require your application to use the optional UI components. A third-party integration needs three connections: the local Portal container, measured layout and viewer input coordination. The following Radix example is a component to render from `renderOverlay`. Install `@radix-ui/react-dialog` as a direct dependency in the consuming app if you import it there.

```tsx
import { useRef, useState, type ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import {
  PanoOverlayPortalProvider, usePanoModal, usePanoOverlay,
} from "@ericchen1990/pano-view";

export function ExistingDialog({ open, onOpenChange, children }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
}) {
  const { portalContainer, visibleRect } = usePanoOverlay();
  const [localContainer, setLocalContainer] = useState<HTMLDivElement | null>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  usePanoModal(open);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      {portalContainer ? (
        <Dialog.Portal container={portalContainer}>
          <Dialog.Overlay style={{ position: "absolute", inset: 0, background: "rgb(0 0 0 / 60%)", pointerEvents: "auto" }} />
          <Dialog.Content
            aria-describedby={undefined}
            style={{
              position: "absolute",
              left: visibleRect.left + visibleRect.width / 2,
              top: visibleRect.top + visibleRect.height / 2,
              transform: "translate(-50%, -50%)",
              width: Math.min(720, Math.max(0, visibleRect.width - 32)),
              maxHeight: Math.max(0, visibleRect.height - 32),
              display: "flex", flexDirection: "column", overflow: "hidden",
              background: "#fff", color: "#17212b", pointerEvents: "auto",
            }}
            onOpenAutoFocus={() => {
              const active = portalContainer.ownerDocument.activeElement;
              previousFocus.current = active instanceof HTMLElement ? active : null;
            }}
            onCloseAutoFocus={(event) => {
              event.preventDefault();
              const previous = previousFocus.current;
              const canvas = portalContainer.closest("[data-pano-viewer]")?.querySelector("canvas");
              const target = previous?.isConnected && previous !== previous.ownerDocument.body && !previous.closest("[inert]") ? previous : canvas;
              if (target && !target.closest("[inert]")) target.focus({ preventScroll: true });
            }}
          >
            <header style={{ display: "flex", justifyContent: "space-between", gap: 16, padding: 20, flexShrink: 0 }}>
              <Dialog.Title style={{ margin: 0 }}>Visitor guide</Dialog.Title>
              <Dialog.Close type="button">Close</Dialog.Close>
            </header>
            <PanoOverlayPortalProvider container={localContainer}>
              <div style={{ minHeight: 0, overflow: "auto", padding: 20 }}>{children}</div>
            </PanoOverlayPortalProvider>
            <div ref={setLocalContainer} style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 2 }} />
          </Dialog.Content>
        </Dialog.Portal>
      ) : null}
    </Dialog.Root>
  );
}
```

Wait for a non-null container. Do not let a third-party Portal default to `document.body` while the viewer is mounting. Existing MUI, Ant Design, shadcn or other wrappers need an equivalent configurable mount target; adapt or wrap the actual Portal API your component exposes. An unsupported wrapper is not made fullscreen-safe merely by rendering it in `renderOverlay`.

`usePanoModal(open)` pauses viewer input and automatic rotation, makes the background viewer UI inert and closes its context menu. It does not supply the third-party modal's focus trap, accessible names, close controls or page scroll handling. Locks are scoped per viewer and reference counted; releasing a modal does not release another modal's or transition's lock. Call hooks unconditionally in a child component, not directly in the `renderOverlay` callback.

<a id="nested-portals"></a>
## Nested portals

Inside `PanoDialogContent`, `usePanoOverlay().portalContainer` points to a nested container inside that dialog. Use it for menus, popovers, selects and tooltips so they stay inside the dialog's focus/interaction boundary and fullscreen subtree. This small tooltip uses React's Portal directly:

```tsx
import { useId, useState } from "react";
import { createPortal } from "react-dom";
import { usePanoOverlay } from "@ericchen1990/pano-view";

// Render inside PanoDialog's content, or inside PanoDialogContent.
export function DialogHelp() {
  const { portalContainer } = usePanoOverlay();
  const id = useId();
  const [visible, setVisible] = useState(false);
  return <>
    <button type="button" aria-describedby={visible ? id : undefined}
      onFocus={() => setVisible(true)} onBlur={() => setVisible(false)}
      onPointerEnter={() => setVisible(true)} onPointerLeave={() => setVisible(false)}>
      About this place
    </button>
    {visible && portalContainer ? createPortal(
      <div id={id} role="tooltip" style={{ position: "absolute", top: 80, left: 16, padding: 12, background: "#17212b", color: "#fff", pointerEvents: "none" }}>
        Follow the path to explore the next room.
      </div>,
      portalContainer,
    ) : null}
  </>;
}
```

The fixed coordinates above only demonstrate the mount target; position production floating UI relative to its trigger. Interactive popovers need `pointer-events: auto` on their actual panel. For a third-party Dialog, create a local target inside Content and use `PanoOverlayPortalProvider` as in the preceding example. Its descendants receive the local target; `size` and `visibleRect` still describe the original viewer and are not nested-popup positioning coordinates.

<a id="fullscreen-and-lifecycle"></a>
## Fullscreen and lifecycle

- Fullscreen is a viewer-level function. Keep its button in global viewer UI, as in the quick start; the dialog itself has no fullscreen button.
- Normal and element fullscreen modes reuse one stable viewer-local container. Do not swap containers or keys on fullscreen changes. Form values, video elements and iframe documents can then remain mounted.
- `size` measures the complete viewer. `visibleRect` intersects it with the visual viewport, accounting for scrolling and viewport changes. The built-in dialog centers in this visible rectangle and reserves 16px gutters. The default body scrolls while the header and Close remain available; the close button's top/right spacing uses the same padding variable, with a safe-area adjustment at the top.
- Closing unmounts dialog content. Reopening starts fresh; store form state above the dialog if it must persist across closes. Use the hotspot ID as the content key to reset state when changing directly between hotspots.
- Escape may be handled by the browser to exit fullscreen. Key events inside an iframe do not bubble to the containing page. Keep a visible Close control and test native/third-party player behavior on your supported browsers.
- This is DOM UI for normal viewing and standard/WebKit element fullscreen. Native video fullscreen and immersive WebXR have separate presentation surfaces.

For Next.js, keep stateful viewer/dialog usage in a Client Component (`"use client"`). Keep initial server and client state consistent, and avoid reading `document` during render. A null Portal container during initial mount is expected.

<a id="api-reference"></a>
## API reference

### `PanoDialog` from `/ui`

| Prop | Type / default | Meaning |
| --- | --- | --- |
| `open` | `boolean`, required | Controlled visibility |
| `onOpenChange` | `(open: boolean) => void`, required | Host updates visibility; clear the selected hotspot when closing |
| `title` | `ReactNode`, required | Visible, accessible title |
| `children` | `ReactNode`, required | Application content |
| `description` | `ReactNode`, optional | Descriptive text below the title |
| `closeLabel` | `string`, `"Close"` | Accessible label for the default close button |
| `className` | `string`, optional | Additional class on Content, not on Backdrop |
| `style` | `CSSProperties`, optional | Content styles; custom properties need a compatible TS type |

`PanoDialog` is a convenience component, not a pass-through for every Radix prop. Use the parts for additional dismissal, focus, DOM and layout options.

### Composable parts from `/ui`

| Export | Contract |
| --- | --- |
| `PanoDialogRoot` | Required `open`, `onOpenChange`, `children`; modal behavior and viewer lock |
| `PanoDialogBackdrop` | Radix Overlay props and div ref, excluding `forceMount`; owns its Portal |
| `PanoDialogContent` | Radix Content props and div ref, excluding `asChild` / `forceMount`; measured layout, focus restoration and nested Portal target |
| `PanoDialogTitle` | Radix Title props/ref; provide a meaningful title |
| `PanoDialogDescription` | Radix Description props/ref; omit and disable `aria-describedby` when absent |
| `PanoDialogClose` | Radix Close props/ref; controls dismissal, without the convenience component's icon or class |

Each export has a corresponding `*Props` type. Root is controlled and does not expose `defaultOpen`, `modal` or Trigger configuration. Close, Title and Description can use Radix `asChild` composition with suitable DOM components.

### Overlay API from the main entry

| API | Contract |
| --- | --- |
| `PanoViewer.renderOverlay(context)` | Returns DOM React content outside the Canvas; not a hook invocation site |
| `usePanoOverlay()` | Same context for DOM descendants; throws outside the Overlay provider |
| `usePanoModal(open)` | Acquires/releases this viewer's modal input lock; no return value |
| `PanoOverlayPortalProvider` | Required `container: HTMLDivElement \| null` and `children`; overrides only the descendant Portal target |
| `PanoOverlayRenderContext` | Exported context type |

| Context field | Meaning |
| --- | --- |
| `portalContainer` | Stable viewer-local `HTMLDivElement \| null`; nested target inside Content |
| `size` | `{ width, height }` of the full viewer, in CSS pixels |
| `visibleRect` | `{ left, top, width, height }` of its viewport-visible intersection, relative to the viewer |
| `isFullscreen` | Whether the viewer is in an element fullscreen subtree |

<a id="troubleshooting"></a>
## Troubleshooting

| Symptom | Check / fix |
| --- | --- |
| Dialog disappears in fullscreen | Inspect the actual Portal node. Mount inside the viewer, including every nested floating component; raising `z-index` on a body Portal does not move it into the fullscreen subtree. |
| Backdrop variable has no effect | Set it on the viewer/ancestor, or pass `style` directly to a composed Backdrop; Content styles cannot reach a sibling. |
| Panel width class has no effect | Use `--pano-dialog-width`; a normal stylesheet rule does not override inline structural width. |
| Custom header/body/close changes do not apply | Use descendant selectors under your Content class, or compose parts. `PanoDialog` has no header/body/close slot props. |
| Unstyled mode still has layout styles | Structural sizing/positioning and pointer behavior are inline by design. Omit `ui/styles.css` and supply visual styling, or use your own Dialog for full DOM ownership. |
| Long content hides Close | In a composed dialog, keep header/footer `flex-shrink: 0`, body `min-height: 0; overflow: auto`, and Content within measured space. |
| Video/form resets on fullscreen changes | Remove fullscreen-dependent keys, container swaps, conditional dialog implementations and component definitions nested in render callbacks. |
| Viewer still moves behind a custom modal | Call `usePanoModal(open)` from the custom component under `renderOverlay`. Default/composed Root already does this. |
| Nested popover is hidden or cannot receive input | Pass the Content-local target from `usePanoOverlay()` and enable pointer events on its actual panel. |
| A hook reports a missing provider | Render the custom DOM component from `renderOverlay`; do not call Overlay hooks in the parent of `PanoViewer` or directly in its callback. |

Before integrating, verify normal and real element fullscreen modes, a partially scrolled viewer, keyboard open/close and focus restoration, long content, nested portals, media cleanup and your supported Safari/mobile devices. A maximized browser window does not exercise the Fullscreen API.
