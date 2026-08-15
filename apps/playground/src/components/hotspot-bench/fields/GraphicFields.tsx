import type { GraphicDefinition } from "@ericchen1990/pano-view";
import type { EditorHotspot } from "../../../types";
import { createGraphic, numberValue } from "../../../utils";

export function GraphicFields({
  hotspot,
  onChange,
}: {
  hotspot: Extract<EditorHotspot, { type: "graphic" }>;
  onChange: (graphic: GraphicDefinition) => void;
}) {
  const graphic = hotspot.graphic;
  const selectableKind = graphic.kind === "path" ? "circle" : graphic.kind;

  return (
    <div className="graphic-fields">
      <label className="field wide">
        <span>Graphic type</span>
        <select
          onChange={(event) => onChange(createGraphic(event.currentTarget.value as "circle" | "rectangle" | "ring" | "svg"))}
          value={selectableKind}
        >
          <option value="circle">Circle</option>
          <option value="rectangle">Rounded rectangle</option>
          <option value="ring">Ring</option>
          <option value="svg">SVG asset</option>
        </select>
      </label>

      {graphic.kind === "svg" ? (
        <label className="field wide">
          <span>SVG URL</span>
          <input onChange={(event) => onChange({ ...graphic, src: event.currentTarget.value })} value={graphic.src} />
        </label>
      ) : (
        <div className="field-grid">
          <label className="field">
            <span>Fill</span>
            <input onChange={(event) => onChange({ ...graphic, fill: event.currentTarget.value })} type="color" value={graphic.fill ?? "#df6b42"} />
          </label>
          <label className="field">
            <span>Stroke</span>
            <input onChange={(event) => onChange({ ...graphic, stroke: event.currentTarget.value })} type="color" value={graphic.stroke ?? "#f5fbfc"} />
          </label>
          <label className="field">
            <span>Stroke width</span>
            <input
              min="0"
              onChange={(event) => onChange({ ...graphic, strokeWidth: numberValue(event.currentTarget.value, graphic.strokeWidth ?? 8) })}
              type="number"
              value={graphic.strokeWidth ?? 8}
            />
          </label>
          {graphic.kind === "rectangle" ? (
            <label className="field">
              <span>Corner radius</span>
              <input
                min="0"
                onChange={(event) => onChange({ ...graphic, cornerRadius: numberValue(event.currentTarget.value, graphic.cornerRadius ?? 0) })}
                type="number"
                value={graphic.cornerRadius ?? 0}
              />
            </label>
          ) : null}
          {graphic.kind === "ring" ? (
            <label className="field">
              <span>Inner radius</span>
              <input
                max="0.95"
                min="0.05"
                onChange={(event) => onChange({ ...graphic, innerRadius: numberValue(event.currentTarget.value, graphic.innerRadius ?? 0.58) })}
                step="0.01"
                type="number"
                value={graphic.innerRadius ?? 0.58}
              />
            </label>
          ) : null}
        </div>
      )}
    </div>
  );
}
