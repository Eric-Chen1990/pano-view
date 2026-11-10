import fullSource from "./BasicsPage.tsx?raw";
import { useState } from "react";
import {
  PanoViewer,
  Sphere,
  Tile,
  type TileLoadProgress,
} from "@ericchen1990/pano-view";
import { cn } from "../../cn";
import {
  pageControlsClassName,
  segmentedButtonClassName,
  segmentedButtonActiveClassName,
} from "../../ui";
import { CodeSnippet } from "../CodeSnippet";
import { ExamplePage } from "../ExamplePage";

const sphere = {
  src: "/fixtures/panorama/panos/1/sphere.webp",
  previewUrl: "preview.webp",
};
const tile = {
  baseUrl: "/fixtures/panorama/cube-tiles/4",
  multires: "512,1000,2000",
  urlTemplate: "tiles/%s/l%l/%v/l%l_%s_%v_%h.webp",
  previewUrl: "previews/cube-vertical.webp",
};

function SourceExample({ source }: { source: "sphere" | "tile" }) {
  const [status, setStatus] = useState("Loading preview…");
  const [error, setError] = useState<string>();
  const [progress, setProgress] = useState<TileLoadProgress>();
  const [level, setLevel] = useState(1);
  return (
    <>
      <p className="px-6 text-sm" role={error ? "alert" : "status"}>
        {error ?? status}
      </p>
      <PanoViewer aria-label="Panorama basics viewer" style={{ height: 540 }}>
        {source === "sphere" ? (
          <Sphere
            {...sphere}
            onReady={() =>
              setStatus((value) =>
                value === "Full image loaded" ? value : "Preview ready",
              )
            }
            onLoad={() => setStatus("Full image loaded")}
            onError={() =>
              setError("Full image could not load. Reload to retry.")
            }
            onPreviewError={() =>
              setStatus("Preview unavailable; loading full image…")
            }
          />
        ) : (
          <Tile
            {...tile}
            onReady={() => setStatus("Preview ready; tiles follow the view")}
            onPreviewError={() =>
              setError("Preview could not load. Reload to retry.")
            }
            onTileError={() =>
              setError(
                "Some tiles could not load; the preview remains available.",
              )
            }
            onLoadProgress={setProgress}
            onLevelChange={setLevel}
          />
        )}
      </PanoViewer>
      {source === "tile" ? (
        <p className="px-6 text-sm" aria-live="polite">
          Level {level} · tiles {progress?.loaded ?? 0}/
          {progress?.requested ?? 0} · failed {progress?.failed ?? 0}. Counts
          change as you look around and zoom.
        </p>
      ) : null}
    </>
  );
}

export function BasicsPage() {
  const [source, setSource] = useState<"sphere" | "tile">("sphere");
  const props = source === "sphere" ? sphere : tile;
  const component = source === "sphere" ? "Sphere" : "Tile";
  const code = `import { PanoViewer, ${component} } from "@ericchen1990/pano-view";
import "@ericchen1990/pano-view/styles.css";

<PanoViewer style={{ height: 540 }}>
  <${component}
${Object.entries(props)
  .map(([key, value]) => `    ${key}=${JSON.stringify(value)}`)
  .join("\n")}
  />
</PanoViewer>`;
  return (
    <ExamplePage
      title="Panorama basics"
      description="Start with one panorama source. Compare a 2:1 image with multiresolution cube tiles, then inspect the required resource paths and loading state."
    >
      <div
        className={pageControlsClassName}
        role="group"
        aria-label="Panorama source"
      >
        {(["sphere", "tile"] as const).map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={source === value}
            className={cn(
              segmentedButtonClassName,
              source === value && segmentedButtonActiveClassName,
            )}
            onClick={() => setSource(value)}
          >
            {value === "sphere" ? "Sphere" : "Cube tiles"}
          </button>
        ))}
      </div>
      <SourceExample key={source} source={source} />
      <p className="px-6 text-sm text-muted-2">
        Sphere previews resolve beside the image. Tile previews and tile
        templates resolve below baseUrl. Use the template and multires values
        matching your converted files.
      </p>
      <CodeSnippet
        label={`${component}: minimal setup`}
        blurb="The demo also displays lifecycle diagnostics: Sphere onReady/onLoad/onError/onPreviewError; Tile onReady/onPreviewError/onLoadProgress/onTileError/onLevelChange. These callbacks observe loading without changing the source configuration."
        code={code}
      />
      <details className="border-t border-line p-5">
        <summary>Complete running example</summary>
        <CodeSnippet
          label="Panorama basics page"
          blurb="Full page implementation, including the displayed controls, loading/error status and example code generation."
          code={fullSource}
        />
      </details>
    </ExamplePage>
  );
}
