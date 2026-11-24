import { parseHotspotChromaKey } from "../../../shared/chroma-key";
import { ChromaKeyFields } from "./chroma-key-fields";
import type { PanoCustomActionDefinition } from "./custom-actions";
import type { ProjectHotspotTrigger } from "@ericchen1990/pano-view/data";
import { CornerFields } from "./corner-fields";
import { HotspotActionEditor } from "./hotspot-action-editor";
import { useState } from "react";
import {
  DEFAULT_HOTSPOT_TOOLTIP_APPEARANCE,
  type HotspotCorners,
  type HotspotPosition,
  type PanoViewerState,
  type ProjectPopupDefinition,
  type ProjectHotspotDefinition,
  type PanoProjectSceneDefinition,
} from "@ericchen1990/pano-view";
import { hotspotFieldSpec } from "./hotspot-field-specs";
import { hotspotFieldDefault } from "./hotspot-defaults";
import {
  Field,
  commonFields,
  pointFields,
  contentFields,
  getField,
  setField,
  setHotspotField,
  type FieldSpec,
} from "./fields";
import type { Translate } from "./i18n";
import { InspectorTabs } from "./inspector-tabs";
import { IconTrash } from "./icons";

export function HotspotInspector({
  hotspot,
  scenes,
  onChange,
  onBegin,
  onEnd,
  onPick,
  getViewPosition,
  getRectangleCorners,
  cursorPreviewUrl,
  resolveMediaUrl,
  popups = [],
  getView,
  onCreatePopup,
  onEditPopup,
  onTest,
  onArrivalPreviewMount,
  customActions,
  t,
}: {
  hotspot: ProjectHotspotDefinition;
  scenes: PanoProjectSceneDefinition[];
  onChange: (hotspot: ProjectHotspotDefinition) => void;
  onBegin: () => void;
  onEnd: () => void;
  onPick: (field: string) => void;
  getViewPosition: () => HotspotPosition;
  getRectangleCorners: (id: string) => HotspotCorners | null;
  cursorPreviewUrl?: string;
  resolveMediaUrl?: (path: string) => string;
  popups?: ProjectPopupDefinition[];
  getView?: () => PanoViewerState;
  customActions?: readonly PanoCustomActionDefinition[];
  onCreatePopup?: (trigger: ProjectHotspotTrigger) => void;
  onEditPopup?: (id: string) => void;
  onTest?: (trigger: ProjectHotspotTrigger) => void;
  onArrivalPreviewMount?: (node: HTMLDivElement | null) => void;
  t: Translate;
}) {
  const [advanced, setAdvanced] = useState("");
  const [advancedError, setAdvancedError] = useState("");
  const portal = hotspot.type === "portal" ? hotspot : undefined;
  const surface = Boolean(portal) || ("mode" in hotspot && hotspot.mode === "surface");
  const update = (name: string, value: unknown) => {
    if (name === "cursor" && value === "custom-image") { onPick("cursor"); return; }
    if (hotspot.type === "portal" && (name === "frame.src" || name === "frame.color") && value === "") value = undefined;
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
    } else next = setHotspotField(next, name, value);
    onChange(next);
  };
  const fields = (specs: FieldSpec[]) =>
    specs.map((spec) => (
      <Field
        key={spec.name}
        spec={{
          ...hotspotFieldSpec({
            ...spec,
            disabled: spec.name === "distance" ? surface
              : spec.name === "soundDistance" ? hotspot.type !== "audio" || !hotspot.spatialAudio
              : spec.name === "scaleMode" ? surface
              : spec.name === "tooltipScaleMode" ? hotspot.tooltipMode === "surface" : spec.disabled,
            defaultValue: portal?.shape === "circle" && spec.name === "width"
              ? portal.height ?? 10
              : hotspotFieldDefault(hotspot, spec.name) ?? spec.defaultValue,
          }),
          ...(portal && spec.label ? { label: spec.label } : {}),
        }}
        value={
          spec.name === "tooltip.text" && typeof hotspot.tooltip === "string"
            ? hotspot.tooltip
            : spec.name === "scaleMode" && surface ? "fov"
            : spec.name === "tooltipScaleMode" && hotspot.tooltipMode === "surface" ? "fov"
            : getField(hotspot, spec.name)
        }
        onChange={(value) => update(spec.name, value)}
        onBegin={onBegin}
        onEnd={onEnd}
        onPick={spec.asset ? () => onPick(spec.name) : undefined}
        previewUrl={spec.name === "cursor" ? cursorPreviewUrl : undefined}
        displayFractionDigits={portal && spec.type === "number" ? 3 : undefined}
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

  const actionEditor = (
    <HotspotActionEditor
      customActions={customActions}
      hotspot={hotspot}
      scenes={scenes}
      popups={popups}
      getView={getView ?? (() => ({ ...getViewPosition(), fov: 75 }))}
      onChange={onChange}
      onBegin={onBegin}
      onEnd={onEnd}
      onCreatePopup={onCreatePopup}
      onEditPopup={onEditPopup}
      onTest={onTest}
      onArrivalPreviewMount={onArrivalPreviewMount}
      t={t}
    />
  );
  const portalFields = contentFields.portal!;
  const frameColor = portal?.frame?.color ?? String(hotspotFieldDefault(hotspot, "frame.color"));
  const frameSwatch = /^#[\da-f]{6}$/i.test(frameColor) ? frameColor
    : /^#[\da-f]{3}$/i.test(frameColor) ? frameColor.replace(/[\da-f]/gi, (digit) => digit + digit)
    : "#87ddd4";

  return (
    <InspectorTabs
      tabs={[
        {
          id: "general",
          label: t(portal ? "Portal settings" : "General"),
          content: portal ? (
            <div className="pne-fields pne-portal-fields">
              {fields(commonFields.slice(0, 1))}
              <fieldset>
                <legend>{t("Destination")}</legend>
                {actionEditor}
                {fields(portalFields.filter(({ name }) => name === "enterOnZoom"))}
              </fieldset>
              <fieldset>
                <legend>{t("Shape and size")}</legend>
                {fields(portalFields.filter(({ name }) => name === "shape"))}
                {fields([
                  { name: "width", type: "number", ...(portal.shape === "circle" ? { label: "Angular diameter (°)" } : {}) },
                  ...(portal.shape === "circle" ? [] : pointFields.filter(({ name }) => name === "height")),
                  ...pointFields.filter(({ name }) => name === "rotation"),
                ])}
                <details>
                  <summary>{t("Position and scale")}</summary>
                  <div className="pne-fields">{fields(pointFields.filter(({ name }) => name.startsWith("position.") || name === "scale"))}</div>
                </details>
              </fieldset>
              <fieldset>
                <legend>{t("Portal frame")}</legend>
                {portal.frame?.src ? (
                  <>
                    {fields(portalFields.filter(({ name }) => name === "frame.src").map((spec) => ({ ...spec, asset: false })))}
                    <button type="button" className="pne-subtle" onClick={() => onPick("frame.src")}>
                      {t("Replace frame image")}
                    </button>
                    <button type="button" className="pne-subtle" onClick={() => update("frame.src", undefined)}>
                      {t("Remove frame image")}
                    </button>
                  </>
                ) : (
                  <>
                    <label>
                      {t("Pick frame color")}
                      <input type="color" value={frameSwatch} onFocus={onBegin} onBlur={onEnd}
                        onChange={(event) => update("frame.color", event.currentTarget.value)} />
                    </label>
                    {fields(portalFields.filter(({ name }) => name === "frame.color"))}
                    <button type="button" className="pne-subtle" onClick={() => onPick("frame.src")}>
                      {t("Choose portal frame image")}
                    </button>
                  </>
                )}
                {fields(portalFields.filter(({ name }) => name === "frame.thickness").map((spec) => portal.frame?.src
                  ? { ...spec, label: "Opening inset", help: "Aligns the live opening with the transparent area of the frame image." }
                  : spec))}
              </fieldset>
              <details>
                <summary>{t("Hotspot behavior")}</summary>
                <div className="pne-fields">{fields(commonFields.slice(1))}</div>
              </details>
            </div>
          ) : (
            <div className="pne-fields">
              {fields(commonFields)}
              <p className="pne-edit-hint">{t("Edit properties below. Drag the hotspot or its vertex handles in the panorama to change its position.")}</p>
              <p className="pne-edit-hint">{t("Editing keeps hotspots selectable and draggable, and pauses media. Use Preview or Test this hotspot to check visitor behavior.")}</p>
            </div>
          ),
        },
        {
          id: "actions",
          label: t("Actions"),
          content: actionEditor,
        },
        {
          id: "appearance",
          label: t("Appearance"),
          content: (
            <>
              <div className="pne-fields">
                {hotspot.type === "callout" ? (
                  <p className="pne-field-help">
                    {t("Leader-line callout content. Configure the title, body text, image, trigger, and line below.")}
                  </p>
                ) : (
                  <>
                    <p className="pne-field-help">
                      {t("Text or images shown to visitors beside the hotspot. Clear both to hide the tooltip. The name is copied only when a hotspot is created.")}
                    </p>
                    {fields([
                      { name: "tooltip.text", label: "Tooltip text", type: "textarea" },
                      { name: "tooltip.image", label: "Tooltip image", asset: true },
                      { name: "tooltip.imageAlt", label: "Tooltip image alt" },
                      {
                        name: "tooltipTrigger",
                        options: ["always", "hover", "click"],
                        optionLabels: {
                          always: "Always visible",
                          hover: "On hover or focus",
                          click: "On click",
                        },
                      },
                      {
                        name: "tooltipPlacement",
                        options: ["top", "bottom", "left", "right"],
                        optionLabels: {
                          top: "Above", bottom: "Below", left: "Left", right: "Right",
                        },
                      },
                      { name: "tooltipMode", options: ["billboard", "surface"] },
                      { name: "tooltipScaleMode", options: ["inherit", "fov", "fixed"] },
                      { name: "tooltipOffset", label: "Tooltip offset (px)", type: "number" },
                    ])}
                    <p className="pne-field-help">
                      {t(hotspot.tooltipAppearance === undefined ? "Using default style" : "Using custom style")}
                    </p>
                    <details>
                      <summary>{t("Custom tooltip style (JSON)")}</summary>
                      {fields([
                        {
                          name: "tooltipAppearance", label: "Appearance", type: "json",
                          defaultValue: DEFAULT_HOTSPOT_TOOLTIP_APPEARANCE,
                        },
                      ])}
                    </details>
                  </>
                )}
              </div>
              <div className="pne-fields">
                {fields(portal ? [] : contentFields[hotspot.type] ?? [])}
                {fields(graphicFields)}
                {(hotspot.type === "image" || hotspot.type === "video") && (
                  <ChromaKeyFields hotspot={hotspot} onChange={key => update("chromaKey", key)}
                    onBegin={onBegin} onEnd={onEnd} resolveMediaUrl={resolveMediaUrl} t={t} />
                )}
              </div>
            </>
          ),
        },
        {
          id: "position",
          label: t("Position"),
          content: "position" in hotspot ? (
            <>
              {hotspot.type === "image" || hotspot.type === "video" ? (
                <CornerFields
                  hotspot={hotspot}
                  getRectangleCorners={getRectangleCorners}
                  onChange={onChange}
                  onBegin={onBegin}
                  onEnd={onEnd}
                  t={t}
                />
              ) : null}
              <div className="pne-fields">
                {fields("corners" in hotspot && hotspot.corners ? pointFields.filter(({ name }) => name === "opacity") : pointFields)}
              </div>
            </>
          ) : (
            <div className="pne-fields">
              {hotspot.vertices.map((vertex, index) => (
                <fieldset key={index}>
                  <legend className="pne-popup-block-legend">
                    <span>{index + 1}</span>
                    <button
                      type="button"
                      className="pne-icon-button"
                      aria-label={`${t("Delete")}: ${index + 1}`}
                      onClick={() =>
                        onChange({
                          ...hotspot,
                          vertices: hotspot.vertices.filter((_, i) => i !== index),
                        })
                      }
                    >
                      <IconTrash />
                    </button>
                  </legend>
                  {(["yaw", "pitch"] as const).map((axis) => (
                    <Field
                      key={axis}
                      spec={hotspotFieldSpec({ name: axis, type: "number" })}
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
          ),
        },
        {
          id: "advanced",
          label: t("Advanced"),
          content: (
            <div className="pne-fields">
              <textarea
                aria-label={t("Advanced properties (JSON)")}
                value={advanced}
                rows={12}
                onFocus={() => {
                  if (!advanced) setAdvanced(JSON.stringify(hotspot, null, 2));
                }}
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
                    if ((value.type === "image" || value.type === "video") && "chromaKey" in value)
                      parseHotspotChromaKey(value.chromaKey);
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
          ),
        },
      ].filter(({ id }) => !portal || (id !== "actions" && id !== "position"))}
    />
  );
}
