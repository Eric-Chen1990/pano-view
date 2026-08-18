import type { GraphicDefinition } from "@ericchen1990/pano-view";
import type { EditorHotspot } from "../../../types";
import {
  fieldClassName,
  fieldGridClassName,
  fieldInputClassName,
  fieldLabelClassName,
  fieldWideClassName,
} from "../../../ui";
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
    <div className="grid gap-1.5">
      <label className={fieldWideClassName}>
        <span className={fieldLabelClassName}>Graphic type</span>
        <select
          className={fieldInputClassName}
          onChange={(event) =>
            onChange(
              createGraphic(
                event.currentTarget.value as
                  | "circle"
                  | "triangle"
                  | "diamond"
                  | "star"
                  | "arrow"
                  | "rectangle"
                  | "ring"
                  | "svg",
              ),
            )
          }
          value={selectableKind}
        >
          <option value="circle">Circle</option>
          <option value="triangle">Triangle</option>
          <option value="diamond">Diamond</option>
          <option value="star">Star</option>
          <option value="arrow">Arrow</option>
          <option value="rectangle">Rounded rectangle</option>
          <option value="ring">Ring</option>
          <option value="svg">SVG asset</option>
        </select>
      </label>

      {graphic.kind === "svg" ? (
        <label className={fieldWideClassName}>
          <span className={fieldLabelClassName}>SVG URL</span>
          <input
            className={fieldInputClassName}
            onChange={(event) => onChange({ ...graphic, src: event.currentTarget.value })}
            value={graphic.src}
          />
        </label>
      ) : (
        <div className={fieldGridClassName}>
          <label className={fieldClassName}>
            <span className={fieldLabelClassName}>Fill</span>
            <input
              className="h-[34px] border border-[#38545b] bg-[#08191d] p-[3px]"
              onChange={(event) => onChange({ ...graphic, fill: event.currentTarget.value })}
              type="color"
              value={graphic.fill ?? "#df6b42"}
            />
          </label>
          <label className={fieldClassName}>
            <span className={fieldLabelClassName}>Stroke</span>
            <input
              className="h-[34px] border border-[#38545b] bg-[#08191d] p-[3px]"
              onChange={(event) => onChange({ ...graphic, stroke: event.currentTarget.value })}
              type="color"
              value={graphic.stroke ?? "#f5fbfc"}
            />
          </label>
          <label className={fieldClassName}>
            <span className={fieldLabelClassName}>Stroke width</span>
            <input
              className={fieldInputClassName}
              min="0"
              onChange={(event) =>
                onChange({
                  ...graphic,
                  strokeWidth: numberValue(event.currentTarget.value, graphic.strokeWidth ?? 8),
                })
              }
              type="number"
              value={graphic.strokeWidth ?? 8}
            />
          </label>
          {graphic.kind === "rectangle" ? (
            <label className={fieldClassName}>
              <span className={fieldLabelClassName}>Corner radius (0-0.5)</span>
              <input
                className={fieldInputClassName}
                max="0.5"
                min="0"
                onChange={(event) =>
                  onChange({
                    ...graphic,
                    cornerRadius: numberValue(event.currentTarget.value, graphic.cornerRadius ?? 0),
                  })
                }
                step="0.01"
                type="number"
                value={graphic.cornerRadius ?? 0}
              />
            </label>
          ) : null}
          {graphic.kind === "ring" ? (
            <label className={fieldClassName}>
              <span className={fieldLabelClassName}>Inner radius</span>
              <input
                className={fieldInputClassName}
                max="0.95"
                min="0.05"
                onChange={(event) =>
                  onChange({
                    ...graphic,
                    innerRadius: numberValue(event.currentTarget.value, graphic.innerRadius ?? 0.58),
                  })
                }
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
