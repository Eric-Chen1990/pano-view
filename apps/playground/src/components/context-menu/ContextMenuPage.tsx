import {
  MIN_PANO_CONTEXT_MENU_BACKGROUND_OPACITY,
  PanoEvents,
  PanoView,
  Sphere,
  type PanoContextMenuAppearance,
  type PanoContextMenuEntry,
  type PanoViewHandle,
} from "@ericchen1990/pano-view";
import { useMemo, useRef, useState } from "react";
import { CodeSnippet } from "../CodeSnippet";
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

const MODE_SNIPPET_META: Record<MenuMode, { label: string; blurb: string }> = {
  default: {
    label: "Default items + appearance",
    blurb: "Keep built-in Reset view / Fullscreen. Tune appearance only.",
  },
  append: {
    label: "append custom items",
    blurb: "Keep the defaults and append a separator plus host actions.",
  },
  presets: {
    label: "Compose from presets",
    blurb: 'Mix preset ids ("resetView", "fullscreen", "separator") with custom items.',
  },
};

function buildContextMenuSnippet(
  mode: MenuMode,
  opacity: number,
  borderRadius: number,
): string {
  const appearance = `{
      background: "#161616",
      color: "#f4f4f4",
      border: "1px solid #2e2e2e",
      borderRadius: ${borderRadius},
      opacity: ${opacity.toFixed(2)},
      itemHoverBackground: "#2a2a2a",
      separatorColor: "#333",
      iconSize: 16,
    }`;
  const copyItem = `{
        id: "copy",
        label: "Copy yaw / pitch",
        icon: <CopyIcon />,
        onSelect: ({ position }) => {
          void navigator.clipboard.writeText(
            \`\${position.yaw.toFixed(2)}, \${position.pitch.toFixed(2)}\`,
          );
        },
      }`;
  const lookHereItem = `{
        id: "look-here",
        label: "Look here",
        image: "/hotspots/signal.svg",
        onSelect: ({ position }) => {
          panoRef.current?.setView({
            yaw: position.yaw,
            pitch: position.pitch,
          });
        },
      }`;

  switch (mode) {
    case "default":
      return `<PanoView
  contextMenu={{
    appearance: ${appearance},
  }}
  style={{ height: 540 }}
>
  <Sphere src="/panoramas/room.webp" />
</PanoView>`;
    case "append":
      return `<PanoView
  contextMenu={{
    appearance: ${appearance},
    append: [
      "separator",
      ${copyItem},
      ${lookHereItem},
    ],
  }}
  style={{ height: 540 }}
>
  <Sphere src="/panoramas/room.webp" />
</PanoView>`;
    case "presets":
      return `<PanoView
  contextMenu={{
    appearance: ${appearance},
    items: [
      "resetView",
      "separator",
      ${copyItem},
      ${lookHereItem},
      "separator",
      "fullscreen",
    ],
  }}
  style={{ height: 540 }}
>
  <Sphere src="/panoramas/room.webp" />
</PanoView>`;
    default: {
      const exhaustive: never = mode;
      throw new Error(`Unhandled menu mode: ${exhaustive}`);
    }
  }
}

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

  const snippet = useMemo(
    () => buildContextMenuSnippet(mode, opacity, borderRadius),
    [borderRadius, mode, opacity],
  );
  const snippetMeta = MODE_SNIPPET_META[mode];

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
              min={MIN_PANO_CONTEXT_MENU_BACKGROUND_OPACITY}
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
        <CodeSnippet
          blurb={snippetMeta.blurb}
          code={snippet}
          label={snippetMeta.label}
        />
      </section>
    </main>
  );
}
