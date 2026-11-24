import { useMemo, useRef, useState } from "react";
import {
  CalloutHotspot,
  PanoViewer,
  Scenes,
  parsePanoProject,
  type CalloutTrigger,
  type PanoViewerHandle,
  type ProjectHotspotDefinition,
} from "@ericchen1990/pano-view";
import { usePlaygroundLanguage } from "../../i18n/language";
import { CUBE_VIEWER_CONFIG, cubeTileJsx, cubeTileProps } from "../../constants";
import {
  controlInputClassName,
  controlLabelClassName,
  segmentedButtonClassName,
} from "../../ui";
import {
  colorToHex,
  composeRgba,
  parseCssColor,
} from "../../utils";
import { ExampleCode } from "../ExampleCode";
import { ExamplePage } from "../ExamplePage";

const panorama = cubeTileProps();
const scenes = [{ id: "callouts", type: "tile", ...panorama }] as const;
const focus =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#75cbd3]";
const button = `${segmentedButtonClassName} ${focus}`;
const image = "/fixtures/hotspots/gallery-card.svg";

type DemoId = "hover" | "click" | "look" | "always";

type DemoSettings = {
  id: DemoId;
  yaw: number;
  pitch: number;
  trigger: CalloutTrigger;
  angle: number;
  length: number;
  color: string;
  background: string;
  titleBackground: string;
  title: string;
  text: string;
  withImage: boolean;
};

const DEFAULT_CARD_BACKGROUND = "rgba(16, 20, 24, 0.86)";
const DEFAULT_TITLE_BACKGROUND = "#1b3a3f";

const demos: DemoSettings[] = [
  {
    id: "hover",
    yaw: -35,
    pitch: 8,
    trigger: "hover",
    angle: 45,
    length: 96,
    color: "#ffffff",
    background: DEFAULT_CARD_BACKGROUND,
    titleBackground: "#8b1e1e",
    title: "Default style",
    text: "The default style can be customized in the default settings.",
    withImage: false,
  },
  {
    id: "click",
    yaw: 25,
    pitch: -6,
    trigger: "click",
    angle: 135,
    length: 110,
    color: "#75cbd3",
    background: DEFAULT_CARD_BACKGROUND,
    titleBackground: DEFAULT_TITLE_BACKGROUND,
    title: "Click to open",
    text: "Tap the marker to toggle this callout.",
    withImage: true,
  },
  {
    id: "look",
    yaw: 0,
    pitch: 18,
    trigger: "look",
    angle: 90,
    length: 88,
    color: "#f5d76e",
    background: DEFAULT_CARD_BACKGROUND,
    titleBackground: DEFAULT_TITLE_BACKGROUND,
    title: "Look at me",
    text: "Center the view on the marker to reveal the card.",
    withImage: false,
  },
  {
    id: "always",
    yaw: 55,
    pitch: 12,
    trigger: "always",
    angle: -20,
    length: 72,
    color: "#df6b42",
    background: DEFAULT_CARD_BACKGROUND,
    titleBackground: DEFAULT_TITLE_BACKGROUND,
    title: "Always on",
    text: "This callout stays open after the entrance animation.",
    withImage: false,
  },
];

function toHotspot(demo: DemoSettings): Extract<ProjectHotspotDefinition, { type: "callout" }> {
  return {
    type: "callout",
    id: demo.id,
    label: demo.title,
    position: { yaw: demo.yaw, pitch: demo.pitch },
    width: 3.2,
    height: 3.2,
    trigger: demo.trigger,
    content: {
      title: demo.title,
      text: demo.text,
      ...(demo.withImage ? { image, imageAlt: demo.title } : {}),
    },
    line: {
      angle: demo.angle,
      length: demo.length,
      color: demo.color,
      width: 2,
    },
    marker: { color: demo.color },
    appearance: {
      background: demo.background,
      titleBackground: demo.titleBackground,
      titleColor: "#ffffff",
      color: "#ffffff",
      accentColor: demo.color,
    },
  };
}

function formatProp(value: unknown): string {
  if (typeof value === "string") return JSON.stringify(value);
  return `{${JSON.stringify(value)}}`;
}

export function CalloutsPage() {
  const { t } = usePlaygroundLanguage();
  const viewer = useRef<PanoViewerHandle>(null);
  const [selectedId, setSelectedId] = useState<DemoId>("hover");
  const [items, setItems] = useState(demos);
  const selected = items.find((item) => item.id === selectedId) ?? items[0]!;

  function selectDemo(id: DemoId) {
    setSelectedId(id);
    const target = items.find((item) => item.id === id);
    if (!target) return;
    void viewer.current?.lookTo(
      { yaw: target.yaw, pitch: target.pitch },
      { duration: 700 },
    );
  }
  const hotspots = useMemo(() => items.map(toHotspot), [items]);
  const project = useMemo(() => {
    const definition = {
      schemaVersion: 1 as const,
      scenes: [
        {
          id: "callouts",
          source: {
            baseUrl: "/fixtures/panorama/cube-tiles/1",
            viewerConfig: CUBE_VIEWER_CONFIG,
          },
          hotspots,
        },
      ],
    };
    return parsePanoProject(definition);
  }, [hotspots]);
  const selectedHotspot = hotspots.find((item) => item.id === selected.id)!;
  const reactCode = `import { CalloutHotspot, PanoViewer, Tile } from "@ericchen1990/pano-view";
import "@ericchen1990/pano-view/styles.css";

export function CalloutExample() {
  return (
    <PanoViewer style={{ height: 540 }} initialView={{ yaw: ${selected.yaw}, pitch: ${selected.pitch}, fov: 70 }}>
      ${cubeTileJsx(panorama)}
      <CalloutHotspot
        id=${formatProp(selectedHotspot.id)}
        position={${JSON.stringify(selectedHotspot.position)}}
        width={3.2}
        height={3.2}
        trigger=${formatProp(selectedHotspot.trigger ?? "hover")}
        content={${JSON.stringify(selectedHotspot.content)}}
        line={${JSON.stringify(selectedHotspot.line)}}
        marker={${JSON.stringify(selectedHotspot.marker)}}
        appearance={${JSON.stringify(selectedHotspot.appearance)}}
      />
    </PanoViewer>
  );
}`;

  function updateSelected(patch: Partial<DemoSettings>) {
    setItems((current) =>
      current.map((item) =>
        item.id === selected.id ? { ...item, ...patch } : item,
      ),
    );
  }

  return (
    <ExamplePage
      title={t("Leader-line callouts")}
      description={t(
        "Reveal text or image cards with an animated leader line from a panorama marker. Trigger on hover, click, look-at, or keep them always open.",
      )}
    >
      <div className="grid lg:grid-cols-[minmax(0,1fr)_20rem]">
        <PanoViewer
          ref={viewer}
          aria-label={t("Callout panorama")}
          className="min-h-[clamp(320px,62dvh,600px)] lg:h-full"
          initialView={{ yaw: 0, pitch: 0, fov: 70 }}
        >
          <Scenes scenes={scenes} />
          {hotspots.map((hotspot) => (
            <CalloutHotspot key={hotspot.id} {...hotspot} />
          ))}
        </PanoViewer>
        <div className="grid content-start gap-4 border-t border-[#244047] p-5 lg:border-t-0 lg:border-l">
          <div className="flex flex-wrap gap-2" role="group" aria-label={t("Callout examples")}>
            {items.map((item) => (
              <button
                key={item.id}
                type="button"
                className={button}
                aria-pressed={item.id === selected.id}
                onClick={() => selectDemo(item.id)}
              >
                {t(item.title)}
              </button>
            ))}
          </div>
          <label className={controlLabelClassName}>
            {t("Trigger")}
            <select
              className={`${controlInputClassName} ${focus}`}
              value={selected.trigger}
              onChange={(event) =>
                updateSelected({
                  trigger: event.currentTarget.value as CalloutTrigger,
                })
              }
            >
              {(
                [
                  ["hover", "On hover"],
                  ["click", "On click"],
                  ["look", "When looking at"],
                  ["always", "Always visible"],
                ] as const
              ).map(([value, label]) => (
                <option key={value} value={value}>
                  {t(label)}
                </option>
              ))}
            </select>
          </label>
          <label className={controlLabelClassName}>
            <span className="flex justify-between">
              {t("Line angle")}
              <span aria-hidden="true">{selected.angle}°</span>
            </span>
            <input
              type="range"
              className={focus}
              min={-180}
              max={180}
              step={1}
              value={selected.angle}
              onChange={(event) =>
                updateSelected({ angle: event.currentTarget.valueAsNumber })
              }
            />
          </label>
          <label className={controlLabelClassName}>
            <span className="flex justify-between">
              {t("Line length")}
              <span aria-hidden="true">{selected.length}px</span>
            </span>
            <input
              type="range"
              className={focus}
              min={40}
              max={180}
              step={1}
              value={selected.length}
              onChange={(event) =>
                updateSelected({ length: event.currentTarget.valueAsNumber })
              }
            />
          </label>
          <label className={controlLabelClassName}>
            {t("Line color")}
            <input
              type="color"
              className={`h-9 w-14 ${focus}`}
              value={selected.color}
              onChange={(event) =>
                updateSelected({ color: event.currentTarget.value })
              }
            />
          </label>
          <label className={controlLabelClassName}>
            {t("Card background")}
            <input
              type="color"
              className={`h-9 w-14 ${focus}`}
              value={colorToHex(selected.background, "#101418")}
              onChange={(event) => {
                const parsed = parseCssColor(event.currentTarget.value);
                if (!parsed) return;
                const current = parseCssColor(selected.background);
                updateSelected({
                  background: composeRgba({
                    ...parsed,
                    a: current?.a ?? 0.86,
                  }),
                });
              }}
            />
          </label>
          <label className={controlLabelClassName}>
            <span className="flex justify-between">
              {t("Background opacity")}
              <span aria-hidden="true">
                {Math.round(
                  (parseCssColor(selected.background)?.a ?? 0.86) * 100,
                )}
                %
              </span>
            </span>
            <input
              type="range"
              className={focus}
              min={0}
              max={1}
              step={0.05}
              value={parseCssColor(selected.background)?.a ?? 0.86}
              onChange={(event) => {
                const parsed = parseCssColor(selected.background) ?? {
                  r: 16,
                  g: 20,
                  b: 24,
                  a: 0.86,
                };
                updateSelected({
                  background: composeRgba({
                    ...parsed,
                    a: event.currentTarget.valueAsNumber,
                  }),
                });
              }}
            />
          </label>
          <label className={controlLabelClassName}>
            {t("Title background")}
            <input
              type="color"
              className={`h-9 w-14 ${focus}`}
              value={colorToHex(selected.titleBackground, "#1b3a3f")}
              onChange={(event) => {
                const parsed = parseCssColor(event.currentTarget.value);
                if (!parsed) return;
                const current = parseCssColor(selected.titleBackground);
                updateSelected({
                  titleBackground: composeRgba({
                    ...parsed,
                    a: current?.a ?? 1,
                  }),
                });
              }}
            />
          </label>
          <label className={controlLabelClassName}>
            <span className="flex justify-between">
              {t("Title background opacity")}
              <span aria-hidden="true">
                {Math.round(
                  (parseCssColor(selected.titleBackground)?.a ?? 1) * 100,
                )}
                %
              </span>
            </span>
            <input
              type="range"
              className={focus}
              min={0}
              max={1}
              step={0.05}
              value={parseCssColor(selected.titleBackground)?.a ?? 1}
              onChange={(event) => {
                const parsed = parseCssColor(selected.titleBackground) ?? {
                  r: 27,
                  g: 58,
                  b: 63,
                  a: 1,
                };
                updateSelected({
                  titleBackground: composeRgba({
                    ...parsed,
                    a: event.currentTarget.valueAsNumber,
                  }),
                });
              }}
            />
          </label>
          <label className={controlLabelClassName}>
            {t("Title")}
            <input
              type="text"
              className={`${controlInputClassName} ${focus}`}
              value={selected.title}
              onChange={(event) =>
                updateSelected({ title: event.currentTarget.value })
              }
            />
          </label>
          <label className={controlLabelClassName}>
            {t("Body text")}
            <textarea
              className={`${controlInputClassName} ${focus}`}
              rows={3}
              value={selected.text}
              onChange={(event) =>
                updateSelected({ text: event.currentTarget.value })
              }
            />
          </label>
          <button
            type="button"
            className={button}
            aria-pressed={selected.withImage}
            onClick={() => updateSelected({ withImage: !selected.withImage })}
          >
            {selected.withImage ? t("Hide image") : t("Show image")}
          </button>
        </div>
      </div>
      <ExampleCode
        react={{
          label: "CalloutHotspot",
          blurb: t("Minimal React example for the selected callout."),
          code: reactCode,
        }}
        json={{
          format: "project",
          files: [
            {
              label: "project.json",
              blurb: t(
                "Project document with every callout in this demo. Load it with parsePanoProject.",
              ),
              value: project,
            },
          ],
        }}
      />
    </ExamplePage>
  );
}
