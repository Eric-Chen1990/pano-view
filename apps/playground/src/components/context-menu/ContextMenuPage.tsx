import {
  PanoEvents,
  PanoView,
  Sphere,
  type PanoContextMenuAppearance,
  type PanoContextMenuEntry,
  type PanoViewHandle,
} from "@ericchen1990/pano-view";
import { useMemo, useRef, useState } from "react";
import { SiteHeader } from "../SiteHeader";

function CopyIcon() {
  return (
    <svg
      aria-hidden
      fill="none"
      height="100%"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.75"
      viewBox="0 0 16 16"
      width="100%"
    >
      <rect height="9" rx="1.5" width="9" x="5" y="5" />
      <path d="M3.5 11V3.5H11" />
    </svg>
  );
}

type MenuMode = "default" | "append" | "presets";

export function ContextMenuPage() {
  const panoRef = useRef<PanoViewHandle>(null);
  const [mode, setMode] = useState<MenuMode>("default");
  const [opacity, setOpacity] = useState(0.95);
  const [borderRadius, setBorderRadius] = useState(8);
  const [lastAction, setLastAction] = useState("Right-click the panorama.");

  const appearance = useMemo<PanoContextMenuAppearance>(
    () => ({
      background: "#161616",
      color: "#f4f4f4",
      border: "1px solid #2e2e2e",
      borderRadius,
      opacity,
      itemHoverBackground: "#2a2a2a",
      separatorColor: "#333",
      iconSize: 16,
    }),
    [borderRadius, opacity],
  );

  const copyItem = useMemo<PanoContextMenuEntry>(
    () => ({
      id: "copy",
      label: "Copy yaw / pitch",
      icon: <CopyIcon />,
      onSelect: ({ position }) => {
        const text = `${position.yaw.toFixed(2)}, ${position.pitch.toFixed(2)}`;
        void navigator.clipboard?.writeText(text);
        setLastAction(`Copied ${text}`);
      },
    }),
    [],
  );

  const lookHereItem = useMemo<PanoContextMenuEntry>(
    () => ({
      id: "look-here",
      label: "Look here",
      image: "/fixtures/hotspots/signal.svg",
      onSelect: ({ position }) => {
        panoRef.current?.setView({
          yaw: position.yaw,
          pitch: position.pitch,
        });
        setLastAction(
          `Look at ${position.yaw.toFixed(1)}°, ${position.pitch.toFixed(1)}°`,
        );
      },
    }),
    [],
  );

  const contextMenu = useMemo(() => {
    if (mode === "default") {
      return { appearance };
    }
    if (mode === "append") {
      return {
        appearance,
        append: ["separator" as const, copyItem, lookHereItem],
      };
    }
    return {
      appearance,
      items: [
        "resetView" as const,
        "separator" as const,
        copyItem,
        lookHereItem,
        "separator" as const,
        "fullscreen" as const,
      ],
    };
  }, [appearance, copyItem, lookHereItem, mode]);

  return (
    <main className="app-shell">
      <SiteHeader />
      <section className="transition-bench" aria-labelledby="context-menu-title">
        <div className="transition-bench-heading">
          <div>
            <p className="eyebrow">Context menu bench</p>
            <h1 id="context-menu-title">Custom right-click menu</h1>
          </div>
          <p>{lastAction}</p>
        </div>
        <div className="transition-bench-controls">
          <div className="scene-buttons" role="group" aria-label="Menu mode">
            <button
              className={mode === "default" ? "active" : ""}
              onClick={() => setMode("default")}
              type="button"
            >
              Default
            </button>
            <button
              className={mode === "append" ? "active" : ""}
              onClick={() => setMode("append")}
              type="button"
            >
              Append custom
            </button>
            <button
              className={mode === "presets" ? "active" : ""}
              onClick={() => setMode("presets")}
              type="button"
            >
              Compose presets
            </button>
          </div>
          <label>
            Opacity
            <input
              max={1}
              min={0.4}
              onChange={(event) => setOpacity(Number(event.currentTarget.value))}
              step={0.01}
              type="range"
              value={opacity}
            />
            <span>{opacity.toFixed(2)}</span>
          </label>
          <label>
            Radius
            <input
              max={20}
              min={0}
              onChange={(event) =>
                setBorderRadius(Number(event.currentTarget.value))
              }
              step={1}
              type="range"
              value={borderRadius}
            />
            <span>{borderRadius}px</span>
          </label>
        </div>
        <div className="transition-viewer">
          <PanoView
            ref={panoRef}
            aria-label="Panorama context menu demo"
            contextMenu={contextMenu}
            style={{ height: 540 }}
          >
            <PanoEvents
              onEnterFullscreen={() => setLastAction("Entered fullscreen")}
              onExitFullscreen={() => setLastAction("Exited fullscreen")}
            />
            <Sphere src="/fixtures/panorama/panos/1.jpg" />
          </PanoView>
        </div>
      </section>
    </main>
  );
}
