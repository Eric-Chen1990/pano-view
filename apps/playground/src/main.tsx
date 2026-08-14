import { StrictMode, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  AutoRotate,
  PanoView,
  Sphere,
  Tile,
  type PanoViewHandle,
  type PanoViewState,
  type TileLoadProgress,
} from "@pano-view/react";
import "./styles.css";

type ViewerMode = "sphere" | "tile";

const INITIAL_VIEW: PanoViewState = {
  yaw: 0,
  pitch: 0,
  fov: 75,
};

const INITIAL_PROGRESS: TileLoadProgress = {
  requested: 0,
  loaded: 0,
  failed: 0,
  active: 0,
  queued: 0,
};

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function App() {
  const viewerRef = useRef<PanoViewHandle>(null);
  const [mode, setMode] = useState<ViewerMode>("sphere");
  const [view, setView] = useState(INITIAL_VIEW);
  const [level, setLevel] = useState(1);
  const [progress, setProgress] = useState(INITIAL_PROGRESS);
  const [autoRotate, setAutoRotate] = useState(false);
  const [tileErrors, setTileErrors] = useState(0);
  const [lastPointerPosition, setLastPointerPosition] = useState<string | null>(
    null,
  );
  const controls = { inertia: true, keyboard: true };

  const selectMode = (nextMode: ViewerMode) => {
    setMode(nextMode);
    setLevel(1);
    setProgress(INITIAL_PROGRESS);
    setTileErrors(0);
    setLastPointerPosition(null);
  };

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="wordmark" href="#viewer" aria-label="Pano View home">
          PANO<span>/</span>VIEW
        </a>
        <p>React 19 · R3F · six-face multires</p>
      </header>

      <section className="hero" aria-labelledby="page-title">
        <div>
          <p className="eyebrow">Component playground</p>
          <h1 id="page-title">One camera.<br />Two projections.</h1>
        </div>
        <p className="lede">
          Drag to look around, scroll or pinch to zoom, and use the live metrics
          to inspect the shared panorama controller.
        </p>
      </section>

      <section className="viewer-card" id="viewer" aria-label="Panorama demo">
        <div className="viewer-toolbar">
          <div className="mode-switch" aria-label="Panorama source" role="group">
            <button
              className={mode === "sphere" ? "active" : ""}
              onClick={() => selectMode("sphere")}
              type="button"
            >
              Sphere
            </button>
            <button
              className={mode === "tile" ? "active" : ""}
              onClick={() => selectMode("tile")}
              type="button"
            >
              Cube Tile
            </button>
          </div>
          <div className="viewer-actions">
            <button
              onClick={() => setAutoRotate((current) => !current)}
              type="button"
            >
              {autoRotate ? "Stop rotation" : "Auto rotate"}
            </button>
            <button onClick={() => viewerRef.current?.reset()} type="button">
              Reset view
            </button>
            <button
              onClick={() => void viewerRef.current?.toggleFullscreen()}
              type="button"
            >
              Fullscreen
            </button>
          </div>
        </div>

        <div className="viewer-frame">
          <PanoView
            key={mode}
            ref={viewerRef}
            aria-label={`${mode} panorama example`}
            className="pano-view"
            controls={controls}
            initialView={INITIAL_VIEW}
            onPanoramaClick={({ position }) => {
              setLastPointerPosition(
                `${position.yaw.toFixed(1)}° / ${position.pitch.toFixed(1)}°`,
              );
            }}
            onViewChange={setView}
          >
            <AutoRotate
              enabled={autoRotate}
              speed={18}
              acceleration={18}
              startDelay={1_000}
            />
            {mode === "sphere" ? (
              <Sphere src="/fixtures/panorama/panos/1.jpg" />
            ) : (
              <Tile
                baseUrl="/fixtures/panorama"
                multires="512,500,1000,2000"
                onLevelChange={setLevel}
                onLoadProgress={setProgress}
                onTileError={() => setTileErrors((count) => count + 1)}
              />
            )}
          </PanoView>
          <div className="reticle" aria-hidden="true" />
          <p className="input-hint">
            {lastPointerPosition
              ? `Click yaw / pitch · ${lastPointerPosition}`
              : "Click to inspect · Drag · Wheel · Pinch · Arrow keys"}
          </p>
        </div>

        <dl className="metrics" aria-label="Viewer state">
          <Metric label="SOURCE" value={mode === "sphere" ? "2:1 SPHERE" : "CUBE TILE"} />
          <Metric label="YAW" value={`${view.yaw.toFixed(1)}°`} />
          <Metric label="PITCH" value={`${view.pitch.toFixed(1)}°`} />
          <Metric label="FOV" value={`${view.fov.toFixed(1)}°`} />
          <Metric label="LOD" value={mode === "tile" ? `L${level}` : "—"} />
          <Metric
            label="TILES"
            value={
              mode === "tile"
                ? `${progress.loaded}/${progress.requested} · ${tileErrors} ERR`
                : "—"
            }
          />
        </dl>
      </section>

      <footer>
        <span>@pano-view/react</span>
        <span>Sphere + krpano-style Cube Tile</span>
      </footer>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
