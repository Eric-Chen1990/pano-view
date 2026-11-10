import { ExamplePage } from "../ExamplePage";
import { CodeSnippet } from "../CodeSnippet";
import { DialogsExample } from "./dialogs-example";
import source from "./dialogs-example.tsx?raw";
import composedSource from "./composed-dialog-example.tsx?raw";
import customSource from "./third-party-dialog-example.tsx?raw";

const minimalCode = `import { useState } from "react";
import { GraphicHotspot, PanoOverlay, PanoViewer, Sphere } from "@ericchen1990/pano-view";
import { PanoDialog } from "@ericchen1990/pano-view/ui";
import "@ericchen1990/pano-view/styles.css";
import "@ericchen1990/pano-view/ui/styles.css";

const stories = [
  { id: "courtyard", title: "Courtyard", text: "Explore the garden and stone paths." },
  { id: "hall", title: "Hall", text: "Discover the architecture and landscape." },
];

export function SharedDialog() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const story = stories.find((entry) => entry.id === selectedId);
  return <PanoViewer style={{ height: 560 }}>
    <Sphere src="/fixtures/panorama/panos/1/sphere.webp" previewUrl="preview.webp" />
    {stories.map((entry, index) => <GraphicHotspot key={entry.id} id={entry.id} ariaLabel={entry.title} position={{ yaw: index * 40 - 20, pitch: 0 }} width={8} height={8} graphic={{ kind: "circle", fill: "#df6b42" }} onClick={() => setSelectedId(entry.id)} />)}
    <PanoOverlay>
      <PanoDialog open={Boolean(story)} onOpenChange={(open) => { if (!open) setSelectedId(null); }} title={story?.title ?? "Story"}>
        <p>{story?.text}</p>
      </PanoDialog>
    </PanoOverlay>
  </PanoViewer>;
}`;

export function OverlayPage() {
  return (
    <ExamplePage
      title="Dialogs & overlays"
      description="Several markers select content for one shared dialog. Compare the default dialog, composed parts and an existing third-party Dialog with the same stories. Enter fullscreen, then open a story to check the nested tooltip."
    >
      <DialogsExample />
      <CodeSnippet
        label="Shared dialog: minimal setup"
        blurb="Marker IDs select text for one PanoDialog inside PanoOverlay. The full example adds images, viewer-local triggers, fullscreen and a nested tooltip, plus comparisons of all three dialog implementations."
        code={minimalCode}
      />
      <details className="border-t border-line p-5">
        <summary>Complete example and dialog implementations</summary>
        <CodeSnippet
          label="Shared dialog: complete example"
          blurb="A single panorama and two ordinary markers share selection state. Viewer-local buttons also open content before the panorama finishes loading."
          code={source}
        />
        <CodeSnippet
          label="Compose dialog parts"
          blurb="Compose a custom header, backdrop and scrollable body with the viewer modal lock and fullscreen positioning supplied by dialog parts."
          code={composedSource}
        />
        <CodeSnippet
          label="Third-party dialog"
          blurb="Radix Dialog integrates through usePanoDialogSurface. Nested portals use the same fullscreen container."
          code={customSource}
        />
      </details>
    </ExamplePage>
  );
}
