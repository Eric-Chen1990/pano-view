import { usePlaygroundLanguage } from "../../i18n/language";
import { cubeTileJsx, cubeTileProps } from "../../constants";
import {
  MIN_PANO_CONTEXT_MENU_BACKGROUND_OPACITY,
  PanoEvents,
  PanoViewer,
  Tile,
  usePanoViewer,
  type PanoContextMenuAppearance,
  type PanoContextMenuEntry,
} from "@ericchen1990/pano-view";
import { useMemo, useState } from "react";
import { cn } from "../../cn";
import {
  eyebrowClassName,
  pageControlsClassName,
  pageHeadingStatusClassName,
  pageHeadingTitleClassName,
  pageHeadingWrapClassName,
  pageSectionClassName,
  segmentedButtonActiveClassName,
  segmentedButtonClassName,
  shellClassName,
} from "../../ui";
import { ExampleCode } from "../ExampleCode";
import { SiteFooter } from "../SiteFooter";
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
  const entries = mode === "default" ? "" : `        ${mode === "append" ? "append" : "items"}: [
${mode === "presets" ? '          "resetView",\n' : ""}          "separator",
          {
            id: "copy",
            label: "Copy yaw / pitch",
            onSelect: ({ position }) => {
              void navigator.clipboard.writeText(
                \`\${position.yaw.toFixed(2)}, \${position.pitch.toFixed(2)}\`,
              );
            },
          },
          {
            id: "look-here",
            label: "Look here",
            image: "/fixtures/hotspots/signal.svg",
            onSelect: ({ position }) => pano.setView({ yaw: position.yaw, pitch: position.pitch }),
          },
${mode === "presets" ? '          "separator",\n          "fullscreen",\n' : ""}        ],\n`;

  return `import { PanoViewer, Tile${mode === "default" ? "" : ", usePanoViewer"} } from "@ericchen1990/pano-view";
import "@ericchen1990/pano-view/styles.css";

export function PanoramaContextMenu() {
${mode === "default" ? "" : "  const pano = usePanoViewer();\n"}
  return (
    <PanoViewer
${mode === "default" ? "" : "      ref={pano.ref}\n"}      contextMenu={{
        appearance: {
          background: "#161616",
          color: "#f4f4f4",
          border: "1px solid #2e2e2e",
          borderRadius: ${borderRadius},
          opacity: ${opacity.toFixed(2)},
          itemHoverBackground: "#2a2a2a",
          separatorColor: "#333",
          iconSize: 16,
        },
${entries}      }}
      style={{ height: 540 }}
    >
      ${cubeTileJsx()}
    </PanoViewer>
  );
}`;
}

export function ContextMenuPage() {
  const { t } = usePlaygroundLanguage();
  const pano = usePanoViewer();
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
        pano.setView({
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
    <main className={shellClassName}>
      <SiteHeader />
      <section
        aria-labelledby="context-menu-title"
        className={cn(pageSectionClassName, "mt-8")}
      >
        <div className={pageHeadingWrapClassName}>
          <div>
            <p className={eyebrowClassName}>{t("Context menu bench")}</p>
            <h1 className={pageHeadingTitleClassName} id="context-menu-title">{t("Custom right-click menu")}</h1>
          </div>
          <p className={pageHeadingStatusClassName}>{lastAction}</p>
        </div>
        <div className={pageControlsClassName}>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label={t("Menu mode")}>
            <button
              className={cn(
                segmentedButtonClassName,
                mode === "default" && segmentedButtonActiveClassName,
              )}
              onClick={() => setMode("default")}
              type="button"
            >{t("Default")}</button>
            <button
              className={cn(
                segmentedButtonClassName,
                mode === "append" && segmentedButtonActiveClassName,
              )}
              onClick={() => setMode("append")}
              type="button"
            >{t("Append custom")}</button>
            <button
              className={cn(
                segmentedButtonClassName,
                mode === "presets" && segmentedButtonActiveClassName,
              )}
              onClick={() => setMode("presets")}
              type="button"
            >{t("Compose presets")}</button>
          </div>
          <label className="grid gap-1.5 text-[0.7rem] uppercase tracking-[0.08em] text-[#88a6ac]">{t("Opacity")}<input
              className="accent-[#df6b42]"
              max={1}
              min={MIN_PANO_CONTEXT_MENU_BACKGROUND_OPACITY}
              onChange={(event) => setOpacity(Number(event.currentTarget.value))}
              step={0.01}
              type="range"
              value={opacity}
            />
            <span className="font-mono text-[0.62rem] text-[#dcecef]">{opacity.toFixed(2)}</span>
          </label>
          <label className="grid gap-1.5 text-[0.7rem] uppercase tracking-[0.08em] text-[#88a6ac]">{t("Radius")}<input
              className="accent-[#df6b42]"
              max={20}
              min={0}
              onChange={(event) =>
                setBorderRadius(Number(event.currentTarget.value))
              }
              step={1}
              type="range"
              value={borderRadius}
            />
            <span className="font-mono text-[0.62rem] text-[#dcecef]">{borderRadius}px</span>
          </label>
        </div>
        <div className="bg-[#020607]">
          <PanoViewer
            ref={pano.ref}
            aria-label={t("Panorama context menu demo")}
            contextMenu={contextMenu}
            style={{ height: 540 }}
          >
            <PanoEvents
              onEnterFullscreen={() => setLastAction("Entered fullscreen")}
              onExitFullscreen={() => setLastAction("Exited fullscreen")}
            />
            <Tile {...cubeTileProps()} />
          </PanoViewer>
        </div>
        <ExampleCode
          react={{
            blurb: snippetMeta.blurb,
            code: snippet,
            label: snippetMeta.label,
          }}
        />
      </section>
      <SiteFooter label="@ericchen1990/pano-view · context menu" />
    </main>
  );
}
