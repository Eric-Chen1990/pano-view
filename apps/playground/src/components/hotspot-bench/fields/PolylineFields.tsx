import type { EditorPolyline } from "../../../types";
import {
  checkboxLabelClassName,
  deleteButtonClassName,
  fieldClassName,
  fieldGridClassName,
  fieldInputClassName,
  fieldLabelClassName,
  fieldWideClassName,
} from "../../../ui";
import { formatPosition, numberValue } from "../../../utils";
import { TooltipFields } from "./TooltipFields";

export function PolylineFields({
  polyline,
  onChange,
  onDelete,
}: {
  polyline: EditorPolyline;
  onChange: (patch: Partial<Omit<EditorPolyline, "id">>) => void;
  onDelete: () => void;
}) {
  return (
    <div className="grid gap-[14px] p-[17px] max-[1180px]:grid-cols-2 max-[760px]:block">
      <label className={fieldWideClassName}>
        <span className={fieldLabelClassName}>Accessible label</span>
        <input
          className={fieldInputClassName}
          onChange={(event) => onChange({ label: event.currentTarget.value })}
          value={polyline.label}
        />
      </label>
      <div className={fieldGridClassName}>
        <label className={fieldClassName}>
          <span className={fieldLabelClassName}>Stroke</span>
          <input
            className="h-[34px] border border-[#38545b] bg-[#08191d] p-[3px]"
            onChange={(event) => onChange({ stroke: event.currentTarget.value })}
            type="color"
            value={polyline.stroke}
          />
        </label>
        <label className={fieldClassName}>
          <span className={fieldLabelClassName}>Stroke width (px)</span>
          <input
            className={fieldInputClassName}
            min="0.5"
            onChange={(event) =>
              onChange({ strokeWidth: numberValue(event.currentTarget.value, polyline.strokeWidth) })
            }
            step="0.5"
            type="number"
            value={polyline.strokeWidth}
          />
        </label>
      </div>
      <label className={fieldWideClassName}>
        <span className={`${fieldLabelClassName} flex justify-between`}>
          Stroke opacity
          <b className="font-mono text-[0.61rem] font-normal text-[#dcecef]">
            {Math.round(polyline.strokeOpacity * 100)}%
          </b>
        </span>
        <input
          className="accent-[#df6b42]"
          max="1"
          min="0"
          onChange={(event) =>
            onChange({
              strokeOpacity: numberValue(event.currentTarget.value, polyline.strokeOpacity),
            })
          }
          step="0.05"
          type="range"
          value={polyline.strokeOpacity}
        />
      </label>
      <label className={`${checkboxLabelClassName} col-span-full`}>
        <input
          className="accent-[#df6b42]"
          checked={polyline.visible}
          onChange={(event) => onChange({ visible: event.currentTarget.checked })}
          type="checkbox"
        />
        <span>Visible in panorama</span>
      </label>
      <label className={`${checkboxLabelClassName} col-span-full`}>
        <input
          className="accent-[#df6b42]"
          checked={polyline.pointerEvents !== "none"}
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
        tooltip={polyline.tooltip ?? {}}
        tooltipOffset={polyline.tooltipOffset ?? 12}
        tooltipPlacement={polyline.tooltipPlacement ?? "top"}
        tooltipTrigger={polyline.tooltipTrigger ?? "always"}
      />
      <div
        aria-label="Polyline vertices"
        className="col-span-full grid gap-[5px] border-t border-[#27454d] pt-[11px]"
      >
        {polyline.vertices.map((vertex, index) => (
          <span
            className="font-mono text-[0.62rem] text-[#9cb2b7]"
            key={`${polyline.id}-position-${index}`}
          >
            V{index + 1} · {formatPosition(vertex)}
          </span>
        ))}
      </div>
      <button className={`${deleteButtonClassName} col-span-full`} onClick={onDelete} type="button">
        Delete polyline
      </button>
    </div>
  );
}
