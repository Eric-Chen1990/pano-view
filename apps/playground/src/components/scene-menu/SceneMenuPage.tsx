import {
  isOverlayCorner,
  PanoOverlay,
  PanoSceneMenu,
  PANO_OVERLAY_ALIGNS,
  Scenes,
  PanoViewer,
  type PanoOverlayAlign,
  type PanoOverlayAxis,
  type PanoSceneMenuItem,
  type PanoSceneMenuLabelAlign,
} from "@ericchen1990/pano-view";
import { useMemo, useState } from "react";
import { TRANSITION_SCENES } from "../../constants";
import { cn } from "../../cn";
import {
  controlLabelClassName,
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
import { CodeSnippet } from "../CodeSnippet";
import { SiteFooter } from "../SiteFooter";
import { SiteHeader } from "../SiteHeader";

const SCENE_MENU_TITLES: Record<(typeof TRANSITION_SCENES)[number]["id"], string> = {
  "sphere-1": "Sphere 1",
  "sphere-2": "Sphere 2",
  "tile-3": "Cube 3",
  "tile-4": "Cube 4",
};

const LABEL_ALIGNS: readonly PanoSceneMenuLabelAlign[] = [
  "start",
  "center",
  "end",
];

function buildSceneMenuSnippet(options: {
  align: PanoOverlayAlign;
  axis: PanoOverlayAxis;
  collapsible: boolean;
  showArrows: boolean;
  loop: boolean;
  dragMotionEnabled: boolean;
  labelAlign: PanoSceneMenuLabelAlign;
  customToggle: boolean;
}): string {
  const {
    align,
    axis,
    collapsible,
    showArrows,
    loop,
    dragMotionEnabled,
    labelAlign,
    customToggle,
  } = options;
  const horizontal =
    align === "top" ||
    align === "bottom" ||
    (isOverlayCorner(align) && axis === "horizontal");
  const sizeProps = horizontal
    ? `      width="80%"`
    : `      height="70%"
      width={160}`;
  const anchorLines = [
    `        align: "${align}",`,
    isOverlayCorner(align) ? `        axis: "${axis}",` : null,
    `        inset: 12,`,
  ]
    .filter((line): line is string => line !== null)
    .join("\n");
  const optionalProps = [
    collapsible ? "      collapsible" : null,
    showArrows ? "      showArrows" : null,
    loop ? "      loop" : null,
    dragMotionEnabled ? null : "      dragMotion={false}",
  ]
    .filter((line): line is string => line !== null)
    .join("\n");

  return `import { useState } from "react";
import {
  PanoOverlay,
  PanoSceneMenu,
  PanoViewer,
  Scenes,
  type PanoSceneMenuItem,
} from "@ericchen1990/pano-view";
import "@ericchen1990/pano-view/styles.css";

const scenes = [/* sphere + cube scenes */];
const sceneMenuItems: PanoSceneMenuItem[] = [/* id, title, thumbnailUrl */];
const [activeSceneId, setActiveSceneId] = useState("sphere-1");

<PanoViewer style={{ height: "min(640px, 72dvh)" }}>
  <Scenes
    activeSceneId={activeSceneId}
    onActiveSceneIdChange={setActiveSceneId}
    scenes={scenes}
    transition="dissolve"
  />
  <PanoOverlay>
    <PanoSceneMenu
      activeId={activeSceneId}
      anchor={{
${anchorLines}
      }}
      appearance={{
        labelAlign: "${labelAlign}",
        selectionColor: "#7dd3fc",
        selectionWidth: 3,
      }}
${optionalProps ? `${optionalProps}\n` : ""}${customToggle ? `      toggle={{
        style: {
          background: "#0c4a6e",
          color: "#7dd3fc",
          border: "1px solid #7dd3fc",
        },
        icon: ({ collapsed }) => (collapsed ? "+" : "–"),
      }}
` : ""}      items={sceneMenuItems}
      onSelect={setActiveSceneId}
${sizeProps}
    />
  </PanoOverlay>
</PanoViewer>`;
}

export function SceneMenuPage() {
  const [activeSceneId, setActiveSceneId] = useState("sphere-1");
  const [align, setAlign] = useState<PanoOverlayAlign>("bottom");
  const [axis, setAxis] = useState<PanoOverlayAxis>("horizontal");
  const [collapsible, setCollapsible] = useState(true);
  const [showArrows, setShowArrows] = useState(true);
  const [loop, setLoop] = useState(true);
  const [dragMotionEnabled, setDragMotionEnabled] = useState(true);
  const [labelAlign, setLabelAlign] =
    useState<PanoSceneMenuLabelAlign>("center");
  const [customToggle, setCustomToggle] = useState(false);
  const [status, setStatus] = useState(
    "Dock the thumbnail strip and tune chrome.",
  );

  const sceneMenuItems = useMemo((): PanoSceneMenuItem[] => {
    return TRANSITION_SCENES.map((scene) => {
      if (scene.type === "sphere") {
        return {
          id: scene.id,
          title: SCENE_MENU_TITLES[scene.id],
          thumbnailUrl: `/fixtures/panorama/panos/${scene.id === "sphere-1" ? "1" : "2"}/preview.webp`,
        };
      }
      const folder = scene.id === "tile-3" ? "3" : "4";
      return {
        id: scene.id,
        title: SCENE_MENU_TITLES[scene.id],
        thumbnailUrl: `/fixtures/panorama/cube-tiles/${folder}/previews/200.webp`,
      };
    });
  }, []);

  const horizontal =
    align === "top" ||
    align === "bottom" ||
    (isOverlayCorner(align) && axis === "horizontal");
  const snippet = useMemo(
    () =>
      buildSceneMenuSnippet({
        align,
        axis,
        collapsible,
        showArrows,
        loop,
        dragMotionEnabled,
        labelAlign,
        customToggle,
      }),
    [
      align,
      axis,
      collapsible,
      customToggle,
      dragMotionEnabled,
      labelAlign,
      loop,
      showArrows,
    ],
  );

  return (
    <main className={shellClassName}>
      <SiteHeader />
      <section
        aria-labelledby="scene-menu-bench-title"
        className={cn(pageSectionClassName, "mt-8")}
      >
        <div className={pageHeadingWrapClassName}>
          <div>
            <p className={eyebrowClassName}>Scene menu bench</p>
            <h1
              className={pageHeadingTitleClassName}
              id="scene-menu-bench-title"
            >
              Layout the scene list
            </h1>
          </div>
          <p className={pageHeadingStatusClassName}>{status}</p>
        </div>
        <div className={pageControlsClassName}>
          <div className={controlLabelClassName}>
            Align
            <div
              className="flex flex-wrap gap-1.5"
              role="group"
              aria-label="Scene menu align"
            >
              {PANO_OVERLAY_ALIGNS.map((value) => (
                <button
                  className={cn(
                    segmentedButtonClassName,
                    align === value && segmentedButtonActiveClassName,
                  )}
                  key={value}
                  onClick={() => {
                    setAlign(value);
                    setStatus(`Aligned ${value}.`);
                  }}
                  type="button"
                >
                  {value}
                </button>
              ))}
            </div>
          </div>
          {isOverlayCorner(align) ? (
            <div className={controlLabelClassName}>
              Axis
              <div
                className="flex flex-wrap gap-1.5"
                role="group"
                aria-label="Scene menu axis"
              >
                {(["horizontal", "vertical"] as const).map((value) => (
                  <button
                    className={cn(
                      segmentedButtonClassName,
                      axis === value && segmentedButtonActiveClassName,
                    )}
                    key={value}
                    onClick={() => {
                      setAxis(value);
                      setStatus(`Axis ${value}.`);
                    }}
                    type="button"
                  >
                    {value}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          <div className={controlLabelClassName}>
            Label
            <div
              className="flex flex-wrap gap-1.5"
              role="group"
              aria-label="Scene title alignment"
            >
              {LABEL_ALIGNS.map((value) => (
                <button
                  className={cn(
                    segmentedButtonClassName,
                    labelAlign === value && segmentedButtonActiveClassName,
                  )}
                  key={value}
                  onClick={() => {
                    setLabelAlign(value);
                    setStatus(`Title labels ${value}-aligned.`);
                  }}
                  type="button"
                >
                  {value}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className={pageControlsClassName}>
          <div className={controlLabelClassName}>
            Chrome
            <div
              className="flex flex-wrap gap-1.5"
              role="group"
              aria-label="Scene menu chrome"
            >
              <button
                className={cn(
                  segmentedButtonClassName,
                  collapsible && segmentedButtonActiveClassName,
                )}
                onClick={() => {
                  setCollapsible((value) => !value);
                  setStatus(
                    collapsible
                      ? "Menu stays expanded."
                      : "Collapse toggle enabled.",
                  );
                }}
                type="button"
              >
                Collapsible
              </button>
              <button
                className={cn(
                  segmentedButtonClassName,
                  showArrows && segmentedButtonActiveClassName,
                )}
                onClick={() => {
                  setShowArrows((value) => !value);
                  setStatus(
                    showArrows ? "End arrows hidden." : "End arrows shown.",
                  );
                }}
                type="button"
              >
                Arrows
              </button>
              <button
                className={cn(
                  segmentedButtonClassName,
                  loop && segmentedButtonActiveClassName,
                )}
                onClick={() => {
                  setLoop((value) => !value);
                  setStatus(
                    loop
                      ? "Previous/next stop at the ends."
                      : "Previous/next wrap around.",
                  );
                }}
                type="button"
              >
                Loop
              </button>
              <button
                className={cn(
                  segmentedButtonClassName,
                  dragMotionEnabled && segmentedButtonActiveClassName,
                )}
                onClick={() => {
                  setDragMotionEnabled((value) => !value);
                  setStatus(
                    dragMotionEnabled
                      ? "Native overflow scroll."
                      : "Custom drag inertia and bounce.",
                  );
                }}
                type="button"
              >
                Drag motion
              </button>
              <button
                className={cn(
                  segmentedButtonClassName,
                  customToggle && segmentedButtonActiveClassName,
                )}
                onClick={() => {
                  setCustomToggle((value) => !value);
                  setStatus(
                    customToggle
                      ? "Default collapse tab."
                      : "Custom collapse tab icon and color.",
                  );
                }}
                type="button"
              >
                Custom toggle
              </button>
            </div>
          </div>
        </div>
        <div className="bg-[#020607] p-0">
          <PanoViewer
            aria-label="Panorama scene menu demo"
            style={{ height: "min(640px, 72dvh)" }}
          >
            <Scenes
              activeSceneId={activeSceneId}
              maxConcurrentTileLoads={3}
              maxTextureMemoryMb={96}
              onActiveSceneIdChange={setActiveSceneId}
              scenes={TRANSITION_SCENES}
              transition="dissolve"
            />
            <PanoOverlay>
              <PanoSceneMenu
                activeId={activeSceneId}
                anchor={{
                  align,
                  ...(isOverlayCorner(align) ? { axis } : {}),
                  inset: 12,
                }}
                appearance={{
                  labelAlign,
                  selectionColor: "#7dd3fc",
                  selectionWidth: 3,
                }}
                collapsible={collapsible}
                dragMotion={dragMotionEnabled ? undefined : false}
                height={horizontal ? undefined : "70%"}
                items={sceneMenuItems}
                loop={loop}
                onSelect={(id) => {
                  setActiveSceneId(id);
                  setStatus(`Selected ${id}.`);
                }}
                showArrows={showArrows}
                toggle={
                  customToggle
                    ? {
                        style: {
                          background: "#0c4a6e",
                          color: "#7dd3fc",
                          border: "1px solid #7dd3fc",
                        },
                        icon: ({ collapsed }) => (collapsed ? "+" : "–"),
                      }
                    : undefined
                }
                width={horizontal ? "80%" : 160}
              />
            </PanoOverlay>
          </PanoViewer>
        </div>
        <CodeSnippet
          blurb="PanoSceneMenu is host-driven: pass items, activeId, and onSelect inside PanoOverlay. Align, axis, chrome, and appearance update live."
          code={snippet}
          label="PanoSceneMenu"
        />
      </section>
      <SiteFooter label="@ericchen1990/pano-view · panorama scene menu" />
    </main>
  );
}
