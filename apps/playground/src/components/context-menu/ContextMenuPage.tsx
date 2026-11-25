import { message, type LocalizedMessage } from "../../i18n/locale";
import { usePlaygroundLanguage } from "../../i18n/language";
import { cubeTileJsx, cubeTileProps } from "../../constants";
import {
  MIN_PANO_CONTEXT_MENU_BACKGROUND_OPACITY,
  PanoEvents,
  Tile,
  WebVR,
  usePanoViewer,
  type PanoContextMenuAppearance,
  type PanoContextMenuEntry,
} from "@ericchen1990/pano-view";
import { useMemo, useState } from "react";
import { cn } from "../../cn";
import {
  controlLabelClassName,
  pageControlsClassName,
  pageSectionClassName,
  playgroundViewerHeight,
  segmentedButtonActiveClassName,
  segmentedButtonClassName,
  shellClassName,
} from "../../ui";
import { ExampleCode } from "../ExampleCode";
import { PageHeading } from "../PageHeading";
import { SiteFooter } from "../SiteFooter";
import { SiteHeader } from "../SiteHeader";
import { PlaygroundVRViewer } from "../webvr/PlaygroundVRViewer";

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
    blurb: "Keep the built-in items and add Enter VR.",
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
  const entries = mode === "default" ? "        append: [vrEntry],\n" : `        ${mode === "append" ? "append" : "items"}: [
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
${mode === "presets" ? '          { preset: "separator", id: "before-fullscreen" },\n          "fullscreen",\n' : ""}          vrEntry,
        ],\n`;

  return `import { useSyncExternalStore } from "react";
import { PanoViewer, Tile, WebVR, usePanoViewer, type PanoContextMenuActionItem } from "@ericchen1990/pano-view";
import "@ericchen1990/pano-view/styles.css";

export function PanoramaContextMenu() {
  const pano = usePanoViewer();
  const available = useSyncExternalStore(pano.subscribeVR, pano.isVRAvailable, () => false);
  const vrEntry: PanoContextMenuActionItem = {
    id: "enter-vr",
    label: "Enter VR",
    hidden: !available,
    onSelect: () => { void pano.enterVR(); },
  };

  return (
    <PanoViewer
      ref={pano.ref}
      contextMenu={{
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
      style={{ height: ${JSON.stringify(playgroundViewerHeight)} }}
    >
      <WebVR />
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
  const [lastAction, setLastAction] = useState<LocalizedMessage>("Right-click the panorama.");

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
      label: t("Copy yaw / pitch"),
      icon: <CopyIcon />,
      onSelect: ({ position }) => {
        const text = `${position.yaw.toFixed(2)}, ${position.pitch.toFixed(2)}`;
        void navigator.clipboard?.writeText(text);
        setLastAction(message("Copied {value}", { value: text }));
      },
    }),
    [t],
  );

  const lookHereItem = useMemo<PanoContextMenuEntry>(
    () => ({
      id: "look-here",
      label: t("Look here"),
      image: "/fixtures/hotspots/signal.svg",
      onSelect: ({ position }) => {
        pano.setView({
          yaw: position.yaw,
          pitch: position.pitch,
        });
        setLastAction(
          message("Look at {yaw}°, {pitch}°", { yaw: position.yaw.toFixed(1), pitch: position.pitch.toFixed(1) }),
        );
      },
    }),
    [t],
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
        { preset: "separator" as const, id: "before-fullscreen" },
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
        <PageHeading
          id="context-menu-title"
          eyebrow={t("Interaction")}
          title={t("Custom right-click menu")}
          description={t(lastAction)}
        />
        <div className={pageControlsClassName}>
          <div className={controlLabelClassName}>{t("Menu mode")}<div className="flex flex-wrap gap-1.5" role="group" aria-label={t("Menu mode")}>
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
          <PlaygroundVRViewer
            viewer={pano}
            aria-label={t("Panorama context menu demo")}
            contextMenu={contextMenu}
            style={{ height: playgroundViewerHeight }}
          >
            <PanoEvents
              onEnterFullscreen={() => setLastAction("Entered fullscreen")}
              onExitFullscreen={() => setLastAction("Exited fullscreen")}
            />
            <Tile {...cubeTileProps()} />
            <WebVR />
          </PlaygroundVRViewer>
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
