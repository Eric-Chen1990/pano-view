import {
  GraphicHotspot,
  PanoEvents,
  PanoViewer,
  Scenes,
  WebVR,
  WebVRSceneMenu,
  type WebVRSceneMenuProps,
  type WebVRSceneMenuAppearance,
  usePanoViewer,
  type Scene,
} from "@ericchen1990/pano-view";
import { useState, useSyncExternalStore } from "react";
import {
  eyebrowClassName,
  pageHeadingStatusClassName,
  pageHeadingTitleClassName,
  pageHeadingWrapClassName,
  pageSectionClassName,
  segmentedButtonClassName,
  shellClassName,
} from "../../ui";
import { CodeSnippet } from "../CodeSnippet";
import { SiteFooter } from "../SiteFooter";
import { SiteHeader } from "../SiteHeader";

const TILE_SCENE = {
  type: "tile" as const,
  multires: "512,1000,2000",
  urlTemplate: "tiles/%s/l%l/%v/l%l_%s_%v_%h.webp",
  previewUrl: "previews/cube-vertical.webp",
};

const VR_SCENES = [
  { id: "tile-1", ...TILE_SCENE, baseUrl: "/fixtures/panorama/cube-tiles/1" },
  { id: "tile-2", ...TILE_SCENE, baseUrl: "/fixtures/panorama/cube-tiles/2" },
  { id: "tile-3", ...TILE_SCENE, baseUrl: "/fixtures/panorama/cube-tiles/3" },
  { id: "tile-4", ...TILE_SCENE, baseUrl: "/fixtures/panorama/cube-tiles/4" },
] satisfies readonly Scene[];

const INITIAL_SCENE_ID = VR_SCENES[0]!.id;

const PREV_GRAPHIC = {
  kind: "arrow" as const,
  fill: "#df6b42",
  stroke: "#f5fbfc",
  strokeWidth: 10,
};

const NEXT_GRAPHIC = {
  kind: "arrow" as const,
  fill: "#75cbd3",
  stroke: "#f5fbfc",
  strokeWidth: 10,
};

const SCENE_LINKS = {
  "tile-1": [
    {
      id: "prev",
      label: "Tile 4",
      targetSceneId: "tile-4",
      position: { yaw: -32, pitch: -6 },
      rotation: 180,
      graphic: PREV_GRAPHIC,
    },
    {
      id: "next",
      label: "Tile 2",
      targetSceneId: "tile-2",
      position: { yaw: 48, pitch: 2 },
      rotation: 0,
      graphic: NEXT_GRAPHIC,
    },
  ],
  "tile-2": [
    {
      id: "prev",
      label: "Tile 1",
      targetSceneId: "tile-1",
      position: { yaw: 155, pitch: 4 },
      rotation: 210,
      graphic: PREV_GRAPHIC,
    },
    {
      id: "next",
      label: "Tile 3",
      targetSceneId: "tile-3",
      position: { yaw: -78, pitch: -12 },
      rotation: 15,
      graphic: NEXT_GRAPHIC,
    },
  ],
  "tile-3": [
    {
      id: "prev",
      label: "Tile 2",
      targetSceneId: "tile-2",
      position: { yaw: 22, pitch: 18 },
      rotation: 160,
      graphic: PREV_GRAPHIC,
    },
    {
      id: "next",
      label: "Tile 4",
      targetSceneId: "tile-4",
      position: { yaw: -140, pitch: -3 },
      rotation: -25,
      graphic: NEXT_GRAPHIC,
    },
  ],
  "tile-4": [
    {
      id: "prev",
      label: "Tile 3",
      targetSceneId: "tile-3",
      position: { yaw: 88, pitch: -8 },
      rotation: 195,
      graphic: PREV_GRAPHIC,
    },
    {
      id: "next",
      label: "Tile 1",
      targetSceneId: "tile-1",
      position: { yaw: -18, pitch: 10 },
      rotation: 40,
      graphic: NEXT_GRAPHIC,
    },
  ],
} as const;

const MENU_DEFAULTS = {
  layout: "compact" as NonNullable<WebVRSceneMenuProps["layout"]>,
  displayMode: "paged" as NonNullable<WebVRSceneMenuProps["displayMode"]>,
  arcAngle: 180,
  columns: undefined as number | undefined,
  rows: 3,
  loop: true,
  closeOnSelect: true,
  follow: true,
  navigationPitch: -25,
  distance: 2,
  scale: 1,
  fadeDurationMs: 200,
  showTitles: true,
};
const MANY_SCENES: Scene[] = Array.from({ length: 25 }, (_, index) => ({
  ...VR_SCENES[index % 4]!,
  id: index < 4 ? `tile-${index + 1}` : `tour-${index + 1}`,
}));

export function WebVRPage() {
  const viewer = usePanoViewer();
  const vr = useSyncExternalStore(
    viewer.subscribeVR,
    viewer.getVRState,
    viewer.getVRState
  );
  const [settings, setSettings] = useState(MENU_DEFAULTS);
  const [appearance, setAppearance] = useState<WebVRSceneMenuAppearance>({});
  const [many, setMany] = useState(false);
  const [titles, setTitles] = useState<Record<string, string>>({});
  const menuScenes = many ? MANY_SCENES : VR_SCENES;
  const menuItems = menuScenes.map((scene, index) => ({
    id: scene.id,
    title: titles[scene.id] ?? `Scene ${index + 1}`,
    thumbnailUrl: `/fixtures/panorama/cube-tiles/${
      (index % 4) + 1
    }/previews/200.webp`,
  }));
  const [status, setStatus] = useState("Detecting VR capabilities…");
  const [activeSceneId, setActiveSceneId] = useState(INITIAL_SCENE_ID);
  const menuProps: WebVRSceneMenuProps = {
    ...settings,
    appearance,
    items: menuItems,
    activeId: activeSceneId,
    onSelect: setActiveSceneId,
  };
  const [lastClick, setLastClick] = useState(
    "Look at a hotspot in VR to switch scenes"
  );

  return (
    <main className={shellClassName}>
      <SiteHeader />
      <section className={`${pageSectionClassName} mt-6`}>
        <div className={pageHeadingWrapClassName}>
          <div>
            <p className={eyebrowClassName}>Immersive viewer</p>
            <h1 className={pageHeadingTitleClassName}>WebVR</h1>
          </div>
          <p className={pageHeadingStatusClassName}>
            WebXR is preferred on headsets. Phones fall back to stereoscopic
            gyro viewing, while desktop browsers can preview simulated VR. In
            VR, look at a navigation button or hotspot until the reticle ring
            fills. Enter VR from the host button; session Exit / Setup fade
            after idle.
          </p>
        </div>
        <div className="flex items-center gap-3 border-b border-line px-6 py-4">
          <button
            className={segmentedButtonClassName}
            disabled={!vr.available}
            onClick={() =>
              void (vr.enabled ? viewer.exitVR() : viewer.enterVR())
            }
            type="button"
          >
            {vr.enabled ? "Exit VR" : "Enter VR"}
          </button>
          <span className="font-mono text-xs text-muted-2">{status}</span>
          <span className="font-mono text-xs text-muted-2">
            Scene: {activeSceneId}
          </span>
          <span className="font-mono text-xs text-muted-2">{lastClick}</span>
        </div>
        <div className="space-y-3 border-b border-line p-6">
          <div className="flex gap-4">
            <button
              type="button"
              className={segmentedButtonClassName}
              onClick={() => {
                setSettings(MENU_DEFAULTS);
                setAppearance({});
                setTitles({});
              }}
            >
              Reset menu settings
            </button>
            <label>
              <input
                type="checkbox"
                checked={many}
                onChange={(e) => {
                  setMany(e.target.checked);
                  setActiveSceneId(INITIAL_SCENE_ID);
                }}
              />{" "}
              25 scenes
            </label>
          </div>
          <details open>
            <summary>Behavior</summary>
            <div className="flex flex-wrap gap-4 py-3">
              {(["loop", "closeOnSelect", "follow", "showTitles"] as const).map(
                (key) => (
                  <label key={key}>
                    <input
                      type="checkbox"
                      checked={settings[key]}
                      onChange={(e) =>
                        setSettings((value) => ({
                          ...value,
                          [key]: e.target.checked,
                        }))
                      }
                    />{" "}
                    {key}
                  </label>
                )
              )}
              <label>
                Fade (ms){" "}
                <input
                  className="w-20 border p-1"
                  type="number"
                  min="0"
                  max="600"
                  value={settings.fadeDurationMs}
                  onChange={(e) =>
                    setSettings((value) => ({
                      ...value,
                      fadeDurationMs: Number(e.target.value),
                    }))
                  }
                />
              </label>
            </div>
          </details>
          <details>
            <summary>Layout</summary>
            <div className="flex flex-wrap gap-4 py-3">
              <label>
                Layout{" "}
                <select
                  value={settings.layout}
                  onChange={(e) =>
                    setSettings((value) => ({
                      ...value,
                      layout: e.target.value as typeof value.layout,
                      columns: undefined,
                    }))
                  }
                >
                  <option value="compact">Compact</option>
                  <option value="flat">Flat wall</option>
                  <option value="arc">Arc gallery</option>
                </select>
              </label>
              <label>
                Display{" "}
                <select
                  value={settings.displayMode}
                  onChange={(e) =>
                    setSettings((value) => ({
                      ...value,
                      displayMode: e.target.value as typeof value.displayMode,
                    }))
                  }
                >
                  <option value="paged">Paged</option>
                  <option value="all">All scenes</option>
                </select>
              </label>
              <label>
                Arc angle{" "}
                <input
                  type="number"
                  min="60"
                  max="360"
                  disabled={settings.layout !== "arc"}
                  value={settings.arcAngle}
                  onChange={(e) =>
                    setSettings((value) => ({
                      ...value,
                      arcAngle: Number(e.target.value),
                    }))
                  }
                  className="w-20 border p-1"
                />
              </label>
              {(
                [
                  ["columns", 2, settings.layout === "compact" ? 4 : 24, 1],
                  ["rows", 1, 3, 1],
                  ["navigationPitch", -40, -15, 1],
                  ["distance", 1.5, 3, 0.1],
                  ["scale", 0.75, 1.25, 0.05],
                ] as const
              ).map(([key, min, max, step]) => (
                <label key={key}>
                  {key}{" "}
                  <input
                    className="w-20 border p-1"
                    type="number"
                    min={min}
                    max={max}
                    step={step}
                    value={settings[key] ?? ""}
                    placeholder="Auto"
                    disabled={key === "rows" && settings.displayMode === "all"}
                    onChange={(e) =>
                      setSettings((value) => ({
                        ...value,
                        [key]:
                          key === "columns" && e.target.value === ""
                            ? undefined
                            : Number(e.target.value),
                      }))
                    }
                  />
                </label>
              ))}
            </div>
          </details>
          <details>
            <summary>Appearance and scene titles</summary>
            <div className="flex flex-wrap gap-4 py-3">
              {(
                [
                  "controlColor",
                  "controlBackground",
                  "selectionColor",
                  "labelColor",
                  "labelBackground",
                ] as const
              ).map((key) => (
                <label key={key}>
                  {key}{" "}
                  <input
                    className="w-40 border p-1"
                    value={appearance[key] ?? ""}
                    placeholder="Default"
                    onChange={(e) =>
                      setAppearance((value) => ({
                        ...value,
                        [key]: e.target.value || undefined,
                      }))
                    }
                  />
                </label>
              ))}
              {(
                [
                  ["controlOpacity", 0, 1, 0.05],
                  ["borderRadius", 0, 48, 1],
                  ["fontSize", 16, 48, 1],
                ] as const
              ).map(([key, min, max, step]) => (
                <label key={key}>
                  {key}{" "}
                  <input
                    className="w-20 border p-1"
                    type="number"
                    min={min}
                    max={max}
                    step={step}
                    value={appearance[key] ?? ""}
                    placeholder="Default"
                    onChange={(e) =>
                      setAppearance((value) => ({
                        ...value,
                        [key]:
                          e.target.value === ""
                            ? undefined
                            : Number(e.target.value),
                      }))
                    }
                  />
                </label>
              ))}
              <label>
                Title placement{" "}
                <select
                  value={appearance.labelPlacement ?? "center"}
                  onChange={(e) =>
                    setAppearance((value) => ({
                      ...value,
                      labelPlacement: e.target.value as "center" | "bottom",
                    }))
                  }
                >
                  <option value="center">Center</option>
                  <option value="bottom">Bottom</option>
                </select>
              </label>
              <label>
                Current scene title{" "}
                <input
                  className="border p-1"
                  value={
                    titles[activeSceneId] ??
                    menuItems.find((item) => item.id === activeSceneId)
                      ?.title ??
                    ""
                  }
                  onChange={(e) =>
                    setTitles((value) => ({
                      ...value,
                      [activeSceneId]: e.target.value,
                    }))
                  }
                />
              </label>
            </div>
          </details>
        </div>
        <div className="h-[min(68vh,680px)] min-h-105">
          <PanoViewer
            ref={viewer.ref}
            contextMenu={false}
            style={{ height: "100%" }}
          >
            <PanoEvents
              onVRAvailable={() => setStatus("VR is available")}
              onVRDenied={(error) =>
                setStatus(
                  error instanceof Error
                    ? `VR denied: ${error.message}`
                    : "VR permission was denied"
                )
              }
              onVREnter={(mode) => setStatus(`Active mode: ${mode}`)}
              onVRExit={() => setStatus("VR session ended")}
              onVRUnavailable={() => setStatus("VR is unavailable")}
              onVRUnknownDevice={() =>
                setStatus("Unknown screen size — open VR Setup to calibrate")
              }
            />
            <WebVR
              chrome={{
                accent: "#75cbd3",
                background: "rgba(7, 19, 22, 0.82)",
              }}
            />
            <WebVRSceneMenu {...menuProps} />
            <Scenes
              activeSceneId={activeSceneId}
              onActiveSceneIdChange={setActiveSceneId}
              maxConcurrentTileLoads={3}
              maxTextureMemoryMb={96}
              onTransitionEnd={({ previousSceneId, sceneId }) => {
                setLastClick(`${previousSceneId} → ${sceneId}`);
              }}
              onTransitionError={({ sceneId }) => {
                setLastClick(
                  `Could not prepare ${sceneId}; current scene remains visible.`
                );
              }}
              renderHotspots={(scene) => {
                const links = SCENE_LINKS[scene.id as keyof typeof SCENE_LINKS];
                if (!links) {
                  return null;
                }
                return links.map((target) => (
                  <GraphicHotspot
                    ariaLabel={`Go to ${target.label}`}
                    graphic={target.graphic}
                    height={10}
                    id={`${scene.id}-${target.id}`}
                    key={`${scene.id}-${target.id}`}
                    onClick={() => setActiveSceneId(target.targetSceneId)}
                    position={target.position}
                    rotation={target.rotation}
                    tooltip={target.label}
                    tooltipTrigger="hover"
                    width={10}
                  />
                ));
              }}
              scenes={menuScenes}
              transition="crossfade"
            />
          </PanoViewer>
        </div>
        <CodeSnippet
          blurb="Configure compact, flat wall, or arc gallery layouts with paged or all-scene display. Look at a control until the reticle fills to activate it."
          code={`import { useState } from "react";
import { PanoViewer, Scenes, WebVR, WebVRSceneMenu, usePanoViewer } from "@ericchen1990/pano-view";
import "@ericchen1990/pano-view/styles.css";

const scenes = ${JSON.stringify(menuScenes, null, 2)};
const items = ${JSON.stringify(menuItems, null, 2)};
const menuSettings = ${JSON.stringify({ ...settings, appearance }, null, 2)};

export function Tour() {
  const viewer = usePanoViewer();
  const [activeId, setActiveId] = useState(scenes[0].id);
  return <>
    <button onClick={() => void viewer.enterVR()}>Enter VR</button>
    <PanoViewer ref={viewer.ref} style={{ height: 560 }}>
      <WebVR />
      <Scenes scenes={scenes} activeSceneId={activeId} onActiveSceneIdChange={setActiveId} transition="crossfade" />
      <WebVRSceneMenu {...menuSettings} items={items} activeId={activeId} onSelect={setActiveId} />
    </PanoViewer>
  </>;
}`}
          label="WebVR + Scenes"
        />
      </section>
      <SiteFooter label="@ericchen1990/pano-view · WebVR" />
    </main>
  );
}
