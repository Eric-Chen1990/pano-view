import { useState } from "react";
import { cn } from "../../cn";
import {
  pageControlsClassName,
  segmentedButtonClassName,
  segmentedButtonActiveClassName,
} from "../../ui";
import { ExamplePage } from "../ExamplePage";
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

export function SpatialControlsPage() {
  const [kind, setKind] = useState<SpatialExampleKind>("scene-video");
  return (
    <ExamplePage
      title="Spatial controls"
      description="Learn one VR control target at a time: media playback, a host-rendered model, or scrolling content. Gaze until the reticle fills to activate an icon; scrolling continues while you keep looking. Switching examples exits the current session."
    >
      <div
        className={pageControlsClassName}
        role="group"
        aria-label="Spatial control example"
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
            {example.label}
          </button>
        ))}
      </div>
      <SpatialExample key={kind} kind={kind} />
      <p className="px-6 text-sm text-muted-2">
        Icon groups appear only in VR. Outside VR, click the scene video or use
        the 360 player controls; drag the model, scroll to zoom, or focus it and
        use arrow keys. Open the model/article before entering VR to observe
        dialog state across entry and exit.
      </p>
      <CodeSnippet
        label="Spatial controls: complete integration"
        blurb="The running component mounts only the selected target. PanoOverlay owns the dialog and spatial controls; the media and model implementations are below."
        code={source}
      />
      {kind === "scene-video" || kind === "360-video" ? (
        <CodeSnippet
          label="Media controllers"
          blurb="VideoHotspot supplies a controller ref; the 360 player supplies its controller through usePanoViewer. Both feed PanoMediaControls inside PanoSpatialControls."
          code={mediaSource}
        />
      ) : null}
      {kind === "model" ? (
        <CodeSnippet
          label="Host model adapter"
          blurb="The host owns model view state. usePanoSpatialControls connects rotation, zoom and reset to the VR control adapter."
          code={modelSource}
        />
      ) : null}
    </ExamplePage>
  );
}
