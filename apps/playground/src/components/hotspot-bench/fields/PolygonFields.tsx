import type { EditorPolygon } from "../../../types";
import {
  checkboxLabelClassName,
  deleteButtonClassName,
  fieldClassName,
  fieldGridClassName,
  fieldInputClassName,
  fieldLabelClassName,
  fieldOutputClassName,
  fieldWideClassName,
} from "../../../ui";
import { formatPosition, numberValue } from "../../../utils";
import { TooltipFields } from "./TooltipFields";

export function PolygonFields({
  polygon,
  onChange,
  onDelete,
}: {
  polygon: EditorPolygon;
  onChange: (patch: Partial<Omit<EditorPolygon, "id">>) => void;
  onDelete: () => void;
}) {
  return (
    <div className="grid gap-[14px] p-[17px] max-[1180px]:grid-cols-2 max-[760px]:block">
      <label className={fieldWideClassName}>
        <span className={fieldLabelClassName}>Accessible label</span>
        <input
          className={fieldInputClassName}
          onChange={(event) => onChange({ label: event.currentTarget.value })}
          value={polygon.label}
        />
      </label>
      <div className={fieldGridClassName}>
        <label className={fieldClassName}>
          <span className={fieldLabelClassName}>Fill</span>
          <input
            className="h-[34px] border border-[#38545b] bg-[#08191d] p-[3px]"
            onChange={(event) => onChange({ fill: event.currentTarget.value })}
            type="color"
            value={polygon.fill}
          />
        </label>
        <label className={fieldClassName}>
          <span className={fieldLabelClassName}>Stroke</span>
          <input
            className="h-[34px] border border-[#38545b] bg-[#08191d] p-[3px]"
            onChange={(event) => onChange({ stroke: event.currentTarget.value })}
            type="color"
            value={polygon.stroke}
          />
        </label>
        <label className={fieldClassName}>
          <span className={fieldLabelClassName}>Stroke width (px)</span>
          <input
            className={fieldInputClassName}
            min="0.5"
            onChange={(event) =>
              onChange({ strokeWidth: numberValue(event.currentTarget.value, polygon.strokeWidth) })
            }
            step="0.5"
            type="number"
            value={polygon.strokeWidth}
          />
        </label>
        <label className={fieldClassName}>
          <span className={fieldLabelClassName}>Vertices</span>
          <output className={fieldOutputClassName}>{polygon.vertices.length}</output>
        </label>
      </div>
      <label className={fieldWideClassName}>
        <span className={`${fieldLabelClassName} flex justify-between`}>
          Fill opacity
          <b className="font-mono text-[0.61rem] font-normal text-[#dcecef]">
            {Math.round(polygon.fillOpacity * 100)}%
          </b>
        </span>
        <input
          className="accent-[#df6b42]"
          max="1"
          min="0"
          onChange={(event) =>
            onChange({ fillOpacity: numberValue(event.currentTarget.value, polygon.fillOpacity) })
          }
          step="0.05"
          type="range"
          value={polygon.fillOpacity}
        />
      </label>
      <label className={fieldWideClassName}>
        <span className={`${fieldLabelClassName} flex justify-between`}>
          Stroke opacity
          <b className="font-mono text-[0.61rem] font-normal text-[#dcecef]">
            {Math.round(polygon.strokeOpacity * 100)}%
          </b>
        </span>
        <input
          className="accent-[#df6b42]"
          max="1"
          min="0"
          onChange={(event) =>
            onChange({
              strokeOpacity: numberValue(event.currentTarget.value, polygon.strokeOpacity),
            })
          }
          step="0.05"
          type="range"
          value={polygon.strokeOpacity}
        />
      </label>
      <label className={`${checkboxLabelClassName} col-span-full`}>
        <input
          className="accent-[#df6b42]"
          checked={polygon.fillOpacity > 0}
          onChange={(event) =>
            onChange({ fillOpacity: event.currentTarget.checked ? 0.28 : 0 })
          }
          type="checkbox"
        />
        <span>Fill closed polygon</span>
      </label>
      <label className={`${checkboxLabelClassName} col-span-full`}>
        <input
          className="accent-[#df6b42]"
          checked={polygon.visible}
          onChange={(event) => onChange({ visible: event.currentTarget.checked })}
          type="checkbox"
        />
        <span>Visible in panorama</span>
      </label>
      <label className={`${checkboxLabelClassName} col-span-full`}>
        <input
          className="accent-[#df6b42]"
          checked={polygon.pointerEvents !== "none"}
          onChange={(event) =>
            onChange({
              pointerEvents: event.currentTarget.checked ? "auto" : "none",
            })
          }
          type="checkbox"
        />
        <span>Respond to mouse</span>
      </label>
      <TooltipFields
        onChange={onChange}
        tooltip={polygon.tooltip ?? {}}
        tooltipOffset={polygon.tooltipOffset ?? 12}
        tooltipPlacement={polygon.tooltipPlacement ?? "top"}
        tooltipTrigger={polygon.tooltipTrigger ?? "always"}
      />
      <div
        aria-label="Polygon vertices"
        className="col-span-full grid gap-[5px] border-t border-[#27454d] pt-[11px]"
      >
        {polygon.vertices.map((vertex, index) => (
          <span
            className="font-mono text-[0.62rem] text-[#9cb2b7]"
            key={`${polygon.id}-position-${index}`}
          >
            V{index + 1} · {formatPosition(vertex)}
          </span>
        ))}
      </div>
      <button className={`${deleteButtonClassName} col-span-full`} onClick={onDelete} type="button">
        Delete polygon
      </button>
    </div>
  );
}
