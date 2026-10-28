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
