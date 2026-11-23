import { message, type LocalizedMessage } from "../../i18n/locale";
import { usePlaygroundLanguage } from "../../i18n/language";
import {
  PanoEvents,
  PanoViewer,
  PanoOverlay,
  PanoSceneMenu,
  Scenes,
  WebVR,
  WebVRSceneMenu,
  type WebVRSceneMenuProps,
  type WebVRSceneMenuAppearance,
  usePanoViewer,
} from "@ericchen1990/pano-view";
import { useState, useSyncExternalStore } from "react";
import { CUBE_SCENES, INITIAL_CUBE_SCENE_ID } from "../../constants";
import {
  eyebrowClassName,
  pageHeadingStatusClassName,
  pageHeadingTitleClassName,
  pageHeadingWrapClassName,
  pageSectionClassName,
  segmentedButtonClassName,
  shellClassName,
} from "../../ui";
import { ExampleCode } from "../ExampleCode";
import { SiteFooter } from "../SiteFooter";
import { SiteHeader } from "../SiteHeader";

const MENU_DEFAULTS = {
  layout: "compact" as NonNullable<WebVRSceneMenuProps["layout"]>,
  displayMode: "paged" as NonNullable<WebVRSceneMenuProps["displayMode"]>,
  arcAngle: 180,
  columns: undefined as number | undefined,
  rows: 3,
  loop: true,
  closeOnSelect: true,
  follow: true,
  followPitch: true,
  navigationPitch: -25,
  distance: 2,
  scale: 1,
  fadeDurationMs: 200,
  showTitles: true,
  showVisited: false,
};
const MANY_SCENES = Array.from({ length: 25 }, (_, index) => ({
  ...CUBE_SCENES[index % CUBE_SCENES.length]!,
  id: index < 4 ? `tile-${index + 1}` : `tour-${index + 1}`,
}));

export function VRSceneMenuPage() {
  const { t } = usePlaygroundLanguage();
  const viewer = usePanoViewer();
  const vr = useSyncExternalStore(
    viewer.subscribeVR,
    viewer.getVRState,
    viewer.getVRState,
  );
  const [settings, setSettings] = useState(MENU_DEFAULTS);
  const [appearance, setAppearance] = useState<WebVRSceneMenuAppearance>({});
  const [many, setMany] = useState(false);
  const [titles, setTitles] = useState<Record<string, string>>({});
  const menuScenes = many ? MANY_SCENES : CUBE_SCENES;
  const menuItems = menuScenes.map((scene, index) => ({
    id: scene.id,
    title: titles[scene.id] ?? `Scene ${index + 1}`,
    thumbnailUrl: `${scene.baseUrl}/previews/200.webp`,
  }));
  const [status, setStatus] = useState<LocalizedMessage>("Detecting VR capabilities…");
  const [denial, setDenial] = useState<string | null>(null);
  const [activeSceneId, setActiveSceneId] = useState<string>(INITIAL_CUBE_SCENE_ID);
  const menuProps: WebVRSceneMenuProps = {
    ...settings,
    appearance,
    items: menuItems,
    activeId: activeSceneId,
    onSelect: setActiveSceneId,
  };
  const [lastClick, setLastClick] = useState(
    "Open the VR menu to switch scenes",
  );

  return (
    <main className={shellClassName}>
      <SiteHeader />
      <section className={`${pageSectionClassName} mt-6`}>
        <div className={pageHeadingWrapClassName}>
          <div>
            <p className={eyebrowClassName}>{t("Immersive viewer")}</p>
            <h1 className={pageHeadingTitleClassName}>{t("VR scene menu")}</h1>
          </div>
          <p className={pageHeadingStatusClassName}>{t("Configure a spatial scene menu: compare layouts, pagination and appearance. Enter VR, then gaze at the menu button until the reticle fills. Open the advanced settings to customize behavior and titles.")}</p>
        </div>
        <div className="flex items-center gap-3 border-b border-line px-6 py-4">
          <button
            className={segmentedButtonClassName}
            disabled={!vr.available}
            onClick={() => {
              setDenial(null);
              void (vr.enabled ? viewer.exitVR() : viewer.enterVR()).catch(() =>
                setDenial("VR could not start. Check browser support and permissions, then retry."),
              );
            }}
            type="button"
          >
            {vr.enabled ? t("Exit VR") : t("Enter VR")}
          </button>
          <span role="status" className="font-mono text-xs text-muted-2">
            {denial ? t("VR denied: {reason}", { reason: t(denial) }) : t(status)}
          </span>
          <span className="font-mono text-xs text-muted-2">{t("Scene:") + " "}{activeSceneId}
          </span>
          <span className="font-mono text-xs text-muted-2">{t(lastClick)}</span>
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
            >{t("Reset menu settings")}</button>
            <label>
              <input
                type="checkbox"
                checked={many}
                onChange={(e) => {
                  setMany(e.target.checked);
                  setActiveSceneId(INITIAL_CUBE_SCENE_ID);
                }}
              />{" "}{t("25 scenes")}</label>
          </div>
          <div className="flex flex-wrap gap-4">
            <label>{t("Layout")}{" "}
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
                <option value="compact">{t("Compact")}</option>
                <option value="flat">{t("Flat wall")}</option>
                <option value="arc">{t("Arc gallery")}</option>
              </select>
            </label>
            <label>{t("Display")}{" "}
              <select
                value={settings.displayMode}
                onChange={(e) =>
                  setSettings((value) => ({
                    ...value,
                    displayMode: e.target.value as typeof value.displayMode,
                  }))
                }
              >
                <option value="paged">{t("Paged")}</option>
                <option value="all">{t("All scenes")}</option>
              </select>
            </label>
          </div>
          <details>
            <summary>{t("Behavior")}</summary>
            <div className="flex flex-wrap gap-4 py-3">
              {(["loop", "closeOnSelect", "follow", "followPitch", "showTitles", "showVisited"] as const).map(
                (key) => (
                  <label key={key}>
                    <input
                      type="checkbox"
                      checked={settings[key]}
                      disabled={key === "followPitch" && !settings.follow}
                      onChange={(e) =>
                        setSettings((value) => ({
                          ...value,
                          [key]: e.target.checked,
                        }))
                      }
                    />{" "}
                    {t(key)}
                  </label>
                ),
              )}
              <label>{t("Fade (ms)")}{" "}
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
            <summary>{t("Layout")}</summary>
            <div className="flex flex-wrap gap-4 py-3">
              <label>{t("Arc angle")}{" "}
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
                  {t(key)}{" "}
                  <input
                    className="w-20 border p-1"
                    type="number"
                    min={min}
                    max={max}
                    step={step}
                    value={settings[key] ?? ""}
                    placeholder={t("Auto")}
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
            <summary>{t("Appearance and scene titles")}</summary>
            <div className="flex flex-wrap gap-4 py-3">
              {(
                [
                  "controlColor",
                  "controlBackground",
                  "selectionColor",
                  "focusColor",
                  "labelColor",
                  "labelBackground",
                ] as const
              ).map((key) => (
                <label key={key}>
                  {t(key)}{" "}
                  <input
                    className="w-40 border p-1"
                    value={appearance[key] ?? ""}
                    placeholder={t("Default")}
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
                  ["selectionWidth", 0, 8, 1],
                  ["fontSize", 16, 48, 1],
                ] as const
              ).map(([key, min, max, step]) => (
                <label key={key}>
                  {t(key)}{" "}
                  <input
                    className="w-20 border p-1"
                    type="number"
                    min={min}
                    max={max}
                    step={step}
                    value={appearance[key] ?? ""}
                    placeholder={t("Default")}
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
              <label>{t("Title placement")}{" "}
                <select
                  value={appearance.labelPlacement ?? "center"}
                  onChange={(e) =>
                    setAppearance((value) => ({
                      ...value,
                      labelPlacement: e.target.value as "center" | "bottom",
                    }))
                  }
                >
                  <option value="center">{t("Center")}</option>
                  <option value="bottom">{t("Bottom")}</option>
                </select>
              </label>
              <label>{t("Current scene title")}{" "}
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
                setDenial(
                  error instanceof Error
                    ? error.message
                    : "VR permission was denied",
                )
              }
              onVREnter={(mode) => setStatus(message("Active mode: {mode}", { mode }))}
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
                  `Could not prepare ${sceneId}; current scene remains visible.`,
                );
              }}
              scenes={menuScenes}
              transition="crossfade"
            />
            <PanoOverlay>
              <PanoSceneMenu
                items={menuItems}
                activeId={activeSceneId}
                onSelect={setActiveSceneId}
                showVisited={settings.showVisited}
                width="80%"
                appearance={{
                  selectionColor: appearance.selectionColor,
                  focusColor: appearance.focusColor,
                }}
              />
            </PanoOverlay>
          </PanoViewer>
        </div>
        <ExampleCode
          react={{
            blurb: t("Configure compact, flat wall, or arc gallery layouts with paged or all-scene display. Look at a control until the reticle fills to activate it."),
            code: `import { useState } from "react";
import { PanoViewer, PanoOverlay, PanoSceneMenu, Scenes, WebVR, WebVRSceneMenu, usePanoViewer, type Scene, type WebVRSceneMenuProps } from "@ericchen1990/pano-view";
import "@ericchen1990/pano-view/styles.css";

const scenes = ${JSON.stringify(menuScenes, null, 2)} satisfies readonly Scene[];
const items = ${JSON.stringify(menuItems, null, 2)};
const menuSettings: Partial<WebVRSceneMenuProps> = ${JSON.stringify({ ...settings, appearance }, null, 2)};

export function Tour() {
  const viewer = usePanoViewer();
  const [activeId, setActiveId] = useState(scenes[0].id);
  return <>
    <button onClick={() => void viewer.enterVR()}>Enter VR</button>
    <PanoViewer ref={viewer.ref} style={{ height: 560 }}>
      <WebVR />
      <Scenes scenes={scenes} activeSceneId={activeId} onActiveSceneIdChange={setActiveId} transition="crossfade" />
      <WebVRSceneMenu {...menuSettings} items={items} activeId={activeId} onSelect={setActiveId} />
      <PanoOverlay>
        <PanoSceneMenu
          items={items}
          activeId={activeId}
          onSelect={setActiveId}
          showVisited={menuSettings.showVisited}
          appearance={{
            selectionColor: menuSettings.appearance?.selectionColor,
            focusColor: menuSettings.appearance?.focusColor,
          }}
          width="80%"
        />
      </PanoOverlay>
    </PanoViewer>
  </>;
}`,
            label: "WebVRSceneMenu + Scenes",
          }}
        />
      </section>
      <SiteFooter label="@ericchen1990/pano-view · WebVR" />
    </main>
  );
}
