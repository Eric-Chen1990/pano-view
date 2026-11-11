import { useState } from "react";
import { createPortal } from "react-dom";
import {
  GraphicHotspot,
  PanoOverlay,
  PanoViewer,
  Sphere,
  usePanoOverlay,
  usePanoViewer,
} from "@ericchen1990/pano-view";
import { PanoDialog } from "@ericchen1990/pano-view/ui";
import "@ericchen1990/pano-view/ui/styles.css";
import { cn } from "../../cn";
import {
  pageControlsClassName,
  segmentedButtonClassName,
  segmentedButtonActiveClassName,
  viewerChromeButtonClassName,
} from "../../ui";
import { ComposedHotspotDialog } from "./composed-dialog-example";
import { ThirdPartyDialog } from "./third-party-dialog-example";

const stories = [
  {
    id: "courtyard",
    title: "Courtyard",
    text: "Explore the garden, stone paths and view beside the water.",
    image: 1,
  },
  {
    id: "hall",
    title: "Hall",
    text: "Follow the architecture and discover how this room connects to the landscape.",
    image: 3,
  },
];

type DialogMode = "default" | "composed" | "custom";

function StoryTip() {
  const { portalContainer } = usePanoOverlay();
  const [visible, setVisible] = useState(false);
  return (
    <>
      <button
        type="button"
        className={segmentedButtonClassName}
        aria-describedby={visible ? "story-tip" : undefined}
        onFocus={() => setVisible(true)}
        onBlur={() => setVisible(false)}
        onPointerEnter={() => setVisible(true)}
        onPointerLeave={() => setVisible(false)}
        onKeyDown={(event) => {
          if (event.key === "Escape" && visible) {
            event.stopPropagation();
            setVisible(false);
          }
        }}
      >
        About this story
      </button>
      {visible && portalContainer
        ? createPortal(
            <div
              role="tooltip"
              id="story-tip"
              className="pointer-events-none absolute top-16 right-4 z-10 max-w-64 border border-accent bg-canvas-2 p-3 text-sm"
            >
              This nested tooltip uses the dialog portal container, including in
              fullscreen.
            </div>,
            portalContainer,
          )
        : null}
    </>
  );
}

function DialogChrome({
  selected,
  mode,
  close,
  select,
  fullscreen,
}: {
  selected: string | null;
  mode: DialogMode;
  close: () => void;
  select: (id: string) => void;
  fullscreen: () => void;
}) {
  const { isFullscreen } = usePanoOverlay();
  const story = stories.find((entry) => entry.id === selected);
  const props = {
    open: Boolean(story),
    onOpenChange: (open: boolean) => {
      if (!open) close();
    },
    title: story?.title ?? "Story",
  };
  const content = story ? (
    <article key={story.id} className="grid gap-4">
      <img
        src={`/fixtures/panorama/panos/${story.image}/preview.webp`}
        alt={`${story.title} panorama`}
        className="block h-auto w-full"
      />
      <p>{story.text}</p>
      <StoryTip />
    </article>
  ) : null;
  return (
    <>
      <div className="pointer-events-auto absolute right-4 bottom-4 left-4 flex flex-wrap justify-center gap-2">
        {stories.map((entry) => (
          <button
            type="button"
            key={entry.id}
            className={viewerChromeButtonClassName}
            onClick={() => select(entry.id)}
          >
            Open {entry.title}
          </button>
        ))}
        <button
          type="button"
          className={viewerChromeButtonClassName}
          onClick={fullscreen}
        >
          {isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
        </button>
      </div>
      {mode === "default" ? (
        <PanoDialog {...props}>{content}</PanoDialog>
      ) : mode === "composed" ? (
        <ComposedHotspotDialog {...props}>{content}</ComposedHotspotDialog>
      ) : (
        <ThirdPartyDialog {...props}>{content}</ThirdPartyDialog>
      )}
    </>
  );
}

export function DialogsExample() {
  const viewer = usePanoViewer();
  const [mode, setMode] = useState<DialogMode>("default");
  const [selected, setSelected] = useState<string | null>(null);
  return (
    <>
      <div
        className={pageControlsClassName}
        role="group"
        aria-label="Dialog implementation"
      >
        {(["default", "composed", "custom"] as const).map((value) => (
          <button
            type="button"
            key={value}
            aria-pressed={mode === value}
            className={cn(
              segmentedButtonClassName,
              mode === value && segmentedButtonActiveClassName,
            )}
            onClick={() => setMode(value)}
          >
            {
              {
                default: "Default dialog",
                composed: "Compose parts",
                custom: "Third-party dialog",
              }[value]
            }
          </button>
        ))}
      </div>
      <PanoViewer
        ref={viewer.ref}
        aria-label="Dialogs and overlays viewer"
        style={{ height: 560 }}
      >
        <Sphere
          src="/fixtures/panorama/panos/1/sphere.webp"
          previewUrl="preview.webp"
        />
        {stories.map((story, index) => (
          <GraphicHotspot
            key={story.id}
            id={story.id}
            ariaLabel={`Open ${story.title}`}
            position={{ yaw: index * 40 - 20, pitch: 0 }}
            width={8}
            height={8}
            graphic={{ kind: "circle", fill: "#df6b42" }}
            tooltip={story.title}
            onClick={() => setSelected(story.id)}
          />
        ))}
        <PanoOverlay>
          <DialogChrome
            selected={selected}
            mode={mode}
            select={setSelected}
            close={() => setSelected(null)}
            fullscreen={() => void viewer.toggleFullscreen()}
          />
        </PanoOverlay>
      </PanoViewer>
    </>
  );
}
