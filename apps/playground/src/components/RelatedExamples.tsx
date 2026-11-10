import { PAGE_META, type PlaygroundPath } from "../page-meta";
import { PLAYGROUND_ROUTES } from "../routes";

const related: Partial<Record<PlaygroundPath, readonly PlaygroundPath[]>> = {
  "/basics": ["/controls", "/hotspots", "/project"],
  "/controls": ["/basics", "/hotspots", "/webvr"],
  "/scene-transitions": ["/background-audio", "/scene-menu", "/project"],
  "/scene-menu": ["/scene-transitions", "/map", "/vr-scene-menu"],
  "/map": ["/project", "/scene-menu", "/editor"],
  "/hotspots": ["/controls", "/overlays", "/editor"],
  "/overlays": ["/hotspots", "/spatial-controls", "/immersive-tour"],
  "/context-menu": ["/controls", "/overlays"],
  "/video": ["/basics", "/background-audio", "/spatial-controls"],
  "/background-audio": ["/scene-transitions", "/video", "/project"],
  "/filters": ["/basics", "/hotspots"],
  "/webvr": ["/vr-scene-menu", "/spatial-controls", "/immersive-tour"],
  "/vr-scene-menu": ["/webvr", "/scene-menu", "/spatial-controls"],
  "/spatial-controls": ["/webvr", "/video", "/immersive-tour"],
  "/project": ["/basics", "/overlays", "/editor"],
  "/immersive-tour": ["/overlays", "/spatial-controls", "/webvr"],
  "/editor": ["/project", "/hotspots", "/map"],
};

export function RelatedExamples() {
  const paths = related[window.location.pathname as PlaygroundPath];
  if (!paths) return null;
  return (
    <nav
      aria-label="Related examples"
      className="mt-8 border-t border-line py-5"
    >
      <p className="font-mono text-xs uppercase tracking-wide text-accent">
        Continue learning
      </p>
      <div className="grid gap-4 md:grid-cols-3">
        {paths.map((path) => (
          <a
            key={path}
            href={path}
            className="border border-line p-4 no-underline transition hover:border-accent focus-visible:outline-2 focus-visible:outline-accent"
          >
            <span className="text-sm font-semibold">
              {PLAYGROUND_ROUTES.find((route) => route.path === path)?.navLabel}{" "}
              →
            </span>
            <p className="mb-0 text-xs leading-6 text-muted-2">
              {PAGE_META[path].description}
            </p>
          </a>
        ))}
      </div>
    </nav>
  );
}
