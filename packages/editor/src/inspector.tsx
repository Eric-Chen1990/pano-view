import { useState } from "react";
import type {
  HotspotPosition,
  ProjectHotspotDefinition,
  PanoProjectSceneDefinition,
} from "@ericchen1990/pano-view";
import {
  Field,
  commonFields,
  pointFields,
  contentFields,
  getField,
  setField,
  type FieldSpec,
} from "./fields";
import type { Translate } from "./i18n";

export function HotspotInspector({
  hotspot,
  scenes,
  onChange,
  onBegin,
  onEnd,
  onPick,
  getViewPosition,
  t,
}: {
  hotspot: ProjectHotspotDefinition;
  scenes: PanoProjectSceneDefinition[];
  onChange: (hotspot: ProjectHotspotDefinition) => void;
  onBegin: () => void;
  onEnd: () => void;
  onPick: (field: string) => void;
  getViewPosition: () => HotspotPosition;
  t: Translate;
}) {
  const [advanced, setAdvanced] = useState("");
  const [advancedError, setAdvancedError] = useState("");
  const update = (name: string, value: unknown) => {
    let next = hotspot;
    if (name === "graphic.kind" && hotspot.type === "graphic") {
      const kind = value ?? "circle";
      if (kind === "svg") {
        onPick("graphic.src");
        return;
      }
      const graphic =
        kind === "path"
          ? { kind, path: "M0 0H100V100H0Z", viewBox: [0, 0, 100, 100] }
          : { kind, fill: "#df6b42", stroke: "#ffffff" };
      next = setField(next, "graphic", graphic);
    } else if (
      name === "fontWeight" &&
      typeof value === "string" &&
      /^\d+$/.test(value)
    )
      next = setField(next, name, Number(value));
    else if (name === "tooltip.text") {
      const tooltip =
        typeof hotspot.tooltip === "object"
          ? { ...hotspot.tooltip, text: value as string | undefined }
          : value;
      next = setField(next, "tooltip", tooltip);
    } else if (
      name.startsWith("tooltip.") &&
      typeof hotspot.tooltip === "string"
    )
      next = setField(
        { ...hotspot, tooltip: { text: hotspot.tooltip } },
        name,
        value,
      );
    else next = setField(next, name, value);
    onChange(next);
  };
  const fields = (specs: FieldSpec[]) =>
    specs.map((spec) => (
      <Field
        key={spec.name}
        spec={
          hotspot.type === "video" && spec.name === "muted"
            ? { ...spec, defaultValue: true }
            : spec
        }
        value={
          spec.name === "tooltip.text" && typeof hotspot.tooltip === "string"
            ? hotspot.tooltip
            : getField(hotspot, spec.name)
        }
        onChange={(value) => update(spec.name, value)}
        onBegin={onBegin}
        onEnd={onEnd}
        onPick={spec.asset ? () => onPick(spec.name) : undefined}
        t={t}
      />
    ));
  const graphicFields: FieldSpec[] =
    hotspot.type !== "graphic"
      ? []
      : hotspot.graphic.kind === "svg"
        ? [{ name: "graphic.src", asset: true, label: "Src" }]
        : [
            { name: "graphic.fill", label: "Fill" },
            { name: "graphic.stroke", label: "Stroke" },
            {
              name: "graphic.strokeWidth",
              type: "number",
              label: "Stroke width",
            },
            ...(hotspot.graphic.kind === "rectangle"
              ? [{ name: "graphic.cornerRadius", type: "number" as const }]
              : []),
            ...(hotspot.graphic.kind === "ring"
              ? [{ name: "graphic.innerRadius", type: "number" as const }]
              : []),
            ...(hotspot.graphic.kind === "path"
              ? [
                  { name: "graphic.path" },
                  { name: "graphic.viewBox", type: "json" as const },
                ]
              : []),
          ];
  return (
    <div className="pne-inspector-fields">
      <details open>
        <summary>{t("General")}</summary>
        <div className="pne-fields">
          {fields(commonFields)}
          <label>
            {t("Target scene")}
            <select
              value={hotspot.action?.sceneId ?? ""}
              onChange={(event) =>
                onChange({
                  ...hotspot,
                  action: event.currentTarget.value
                    ? { type: "scene", sceneId: event.currentTarget.value }
                    : undefined,
                })
              }
            >
              <option value="">{t("No action")}</option>
              {scenes.map((scene) => (
                <option key={scene.id} value={scene.id}>
                  {scene.title ?? scene.id}
                </option>
              ))}
            </select>
          </label>
        </div>
      </details>
      {"position" in hotspot ? (
        <details open>
          <summary>{t("Position and size")}</summary>
          <div className="pne-fields">{fields(pointFields)}</div>
        </details>
      ) : (
        <details open>
          <summary>{t("Vertices")}</summary>
          <div className="pne-fields">
            {hotspot.vertices.map((vertex, index) => (
              <fieldset key={index}>
                <legend>{index + 1}</legend>
                {(["yaw", "pitch"] as const).map((axis) => (
                  <Field
                    key={axis}
                    spec={{ name: axis, type: "number" }}
                    value={vertex[axis]}
                    onBegin={onBegin}
                    onEnd={onEnd}
                    onChange={(value) => {
                      if (typeof value !== "number")
                        throw new Error("Coordinate is required");
                      onChange({
                        ...hotspot,
                        vertices: hotspot.vertices.map((point, i) =>
                          i === index ? { ...point, [axis]: value } : point,
                        ),
                      });
                    }}
                    t={t}
                  />
                ))}
                <button
                  type="button"
                  onClick={() =>
                    onChange({
                      ...hotspot,
                      vertices: hotspot.vertices.filter((_, i) => i !== index),
                    })
                  }
                >
                  {t("Delete")}
                </button>
              </fieldset>
            ))}
            <button
              type="button"
              onClick={() =>
                onChange({
                  ...hotspot,
                  vertices: [...hotspot.vertices, getViewPosition()],
                })
              }
            >
              {t("Add vertex at view center")}
            </button>
          </div>
        </details>
      )}
      <details open>
        <summary>{t("Content")}</summary>
        <div className="pne-fields">
          {fields(contentFields[hotspot.type] ?? [])}
          {fields(graphicFields)}
        </div>
      </details>
      <details>
        <summary>{t("Tooltip")}</summary>
        <div className="pne-fields">
          {fields([
            { name: "tooltip.text", label: "Tooltip text", type: "textarea" },
            { name: "tooltip.image", label: "Tooltip image", asset: true },
            { name: "tooltip.imageAlt", label: "Tooltip image alt" },
            { name: "tooltipTrigger", options: ["always", "hover", "click"] },
            {
              name: "tooltipPlacement",
              options: ["top", "bottom", "left", "right"],
            },
            { name: "tooltipOffset", type: "number" },
            { name: "tooltipAppearance", label: "Appearance", type: "json" },
          ])}
        </div>
      </details>
      <details
        onToggle={(event) => {
          if (event.currentTarget.open)
            setAdvanced(JSON.stringify(hotspot, null, 2));
        }}
      >
        <summary>{t("Advanced properties (JSON)")}</summary>
        <div className="pne-fields">
          <textarea
            aria-label={t("Advanced properties (JSON)")}
            value={advanced}
            rows={12}
            onChange={(event) => setAdvanced(event.currentTarget.value)}
          />
          <button
            type="button"
            onClick={() => {
              try {
                const value: unknown = JSON.parse(advanced);
                if (
                  !value ||
                  typeof value !== "object" ||
                  !("id" in value) ||
                  value.id !== hotspot.id ||
                  !("type" in value) ||
                  value.type !== hotspot.type
                )
                  throw new Error("Keep the hotspot id and type");
                onChange(value as ProjectHotspotDefinition);
                setAdvancedError("");
              } catch (error) {
                setAdvancedError(
                  error instanceof Error ? error.message : String(error),
                );
              }
            }}
          >
            {t("Apply")}
          </button>
          {advancedError ? <p role="alert">{advancedError}</p> : null}
        </div>
      </details>
    </div>
  );
}
