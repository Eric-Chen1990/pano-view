import {
  PanoSceneMenu,
  Scenes,
  PanoViewer,
  type PanoSceneMenuAlign,
  type PanoSceneMenuItem,
  type PanoSceneMenuLabelAlign,
  type PanoSceneMenuPlacement,
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

const PLACEMENTS: readonly PanoSceneMenuPlacement[] = [
  "top",
  "bottom",
  "left",
  "right",
];

const ALIGNS: readonly PanoSceneMenuAlign[] = ["start", "center", "end"];

const LABEL_ALIGNS: readonly PanoSceneMenuLabelAlign[] = [
  "start",
  "center",
  "end",
];

function isHorizontalPlacement(placement: PanoSceneMenuPlacement): boolean {
  return placement === "top" || placement === "bottom";
}

function buildSceneMenuSnippet(options: {
  placement: PanoSceneMenuPlacement;
  align: PanoSceneMenuAlign;
  collapsible: boolean;
  showArrows: boolean;
  loop: boolean;
  dragMotionEnabled: boolean;
  labelAlign: PanoSceneMenuLabelAlign;
}): string {
  const {
    placement,
    align,
    collapsible,
    showArrows,
    loop,
    dragMotionEnabled,
    labelAlign,
  } = options;
  const horizontal = isHorizontalPlacement(placement);
  const sizeProps = horizontal
    ? `      width="80%"`
    : `      height="70%"
      width={160}`;
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
  PanoSceneMenu,
  PanoViewer,
  Scenes,
  type PanoSceneMenuItem,
} from "@ericchen1990/pano-view";
import "@ericchen1990/pano-view/styles.css";

const scenes = [/* sphere + cube scenes */];
const sceneMenuItems: PanoSceneMenuItem[] = [/* id, title, thumbnailUrl */];
const [activeSceneId, setActiveSceneId] = useState("sphere-1");

<PanoViewer
  renderOverlay={() => (
    <PanoSceneMenu
      activeId={activeSceneId}
      align="${align}"
      appearance={{
        labelAlign: "${labelAlign}",
        selectionColor: "#7dd3fc",
        selectionWidth: 3,
      }}
${optionalProps ? `${optionalProps}\n` : ""}      inset={12}
      items={sceneMenuItems}
      onSelect={setActiveSceneId}
      placement="${placement}"
${sizeProps}
    />
  )}
  style={{ height: "min(640px, 72dvh)" }}
>
  <Scenes
    activeSceneId={activeSceneId}
    onActiveSceneIdChange={setActiveSceneId}
    scenes={scenes}
    transition="dissolve"
  />
</PanoViewer>`;
}

export function SceneMenuPage() {
  const [activeSceneId, setActiveSceneId] = useState("sphere-1");
  const [placement, setPlacement] =
    useState<PanoSceneMenuPlacement>("bottom");
  const [align, setAlign] = useState<PanoSceneMenuAlign>("center");
  const [collapsible, setCollapsible] = useState(true);
  const [showArrows, setShowArrows] = useState(true);
  const [loop, setLoop] = useState(true);
  const [dragMotionEnabled, setDragMotionEnabled] = useState(true);
  const [labelAlign, setLabelAlign] =
    useState<PanoSceneMenuLabelAlign>("center");
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

  const horizontal = isHorizontalPlacement(placement);
  const snippet = useMemo(
    () =>
      buildSceneMenuSnippet({
        placement,
        align,
        collapsible,
        showArrows,
        loop,
        dragMotionEnabled,
        labelAlign,
      }),
    [
      align,
      collapsible,
      dragMotionEnabled,
      labelAlign,
      loop,
      placement,
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
            Placement
            <div
              className="flex flex-wrap gap-1.5"
              role="group"
              aria-label="Scene menu placement"
            >
              {PLACEMENTS.map((value) => (
                <button
                  className={cn(
                    segmentedButtonClassName,
                    placement === value && segmentedButtonActiveClassName,
                  )}
                  key={value}
                  onClick={() => {
                    setPlacement(value);
                    setStatus(`Docked ${value}.`);
                  }}
                  type="button"
                >
                  {value}
                </button>
              ))}
            </div>
          </div>
          <div className={controlLabelClassName}>
            Align
            <div
              className="flex flex-wrap gap-1.5"
              role="group"
              aria-label="Scene menu align"
            >
              {ALIGNS.map((value) => (
                <button
                  className={cn(
                    segmentedButtonClassName,
                    align === value && segmentedButtonActiveClassName,
                  )}
                  key={value}
                  onClick={() => {
                    setAlign(value);
                    setStatus(`Aligned ${value} along the dock edge.`);
                  }}
                  type="button"
                >
                  {value}
                </button>
              ))}
            </div>
          </div>
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
            </div>
          </div>
        </div>
        <div className="bg-[#020607] p-0">
          <PanoViewer
            aria-label="Panorama scene menu demo"
            renderOverlay={() => (
              <PanoSceneMenu
                activeId={activeSceneId}
                align={align}
                appearance={{
                  labelAlign,
                  selectionColor: "#7dd3fc",
                  selectionWidth: 3,
                }}
                collapsible={collapsible}
                dragMotion={dragMotionEnabled ? undefined : false}
                height={horizontal ? undefined : "70%"}
                inset={12}
                items={sceneMenuItems}
                loop={loop}
                onSelect={(id) => {
                  setActiveSceneId(id);
                  setStatus(`Selected ${id}.`);
                }}
                placement={placement}
                showArrows={showArrows}
                width={horizontal ? "80%" : 160}
              />
            )}
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
          </PanoViewer>
        </div>
        <CodeSnippet
          blurb="PanoSceneMenu is host-driven: pass items, activeId, and onSelect through renderOverlay. Placement, align, chrome, and appearance update live."
          code={snippet}
          label="PanoSceneMenu"
        />
      </section>
      <SiteFooter label="@ericchen1990/pano-view · panorama scene menu" />
    </main>
  );
}
