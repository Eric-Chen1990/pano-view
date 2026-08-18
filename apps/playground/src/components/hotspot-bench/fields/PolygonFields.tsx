import type { EditorPolygon } from "../../../types";
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
    <div className="inspector-content">
      <label className="field wide">
        <span>Accessible label</span>
        <input onChange={(event) => onChange({ label: event.currentTarget.value })} value={polygon.label} />
      </label>
      <div className="field-grid">
        <label className="field">
          <span>Fill</span>
          <input onChange={(event) => onChange({ fill: event.currentTarget.value })} type="color" value={polygon.fill} />
        </label>
        <label className="field">
          <span>Stroke</span>
          <input onChange={(event) => onChange({ stroke: event.currentTarget.value })} type="color" value={polygon.stroke} />
        </label>
        <label className="field">
          <span>Stroke width (px)</span>
          <input
            min="0.5"
            onChange={(event) => onChange({ strokeWidth: numberValue(event.currentTarget.value, polygon.strokeWidth) })}
            step="0.5"
            type="number"
            value={polygon.strokeWidth}
          />
        </label>
        <label className="field">
          <span>Vertices</span>
          <output className="field-output">{polygon.vertices.length}</output>
        </label>
      </div>
      <label className="field wide range-field">
        <span>Fill opacity <b>{Math.round(polygon.fillOpacity * 100)}%</b></span>
        <input
          max="1"
          min="0"
          onChange={(event) => onChange({ fillOpacity: numberValue(event.currentTarget.value, polygon.fillOpacity) })}
          step="0.05"
          type="range"
          value={polygon.fillOpacity}
        />
      </label>
      <label className="field wide range-field">
        <span>Stroke opacity <b>{Math.round(polygon.strokeOpacity * 100)}%</b></span>
        <input
          max="1"
          min="0"
          onChange={(event) => onChange({ strokeOpacity: numberValue(event.currentTarget.value, polygon.strokeOpacity) })}
          step="0.05"
          type="range"
          value={polygon.strokeOpacity}
        />
      </label>
      <label className="check-field">
        <input
          checked={polygon.fillOpacity > 0}
          onChange={(event) => onChange({ fillOpacity: event.currentTarget.checked ? 0.28 : 0 })}
          type="checkbox"
        />
        <span>Fill closed polygon</span>
      </label>
      <label className="check-field">
        <input
          checked={polygon.visible}
          onChange={(event) => onChange({ visible: event.currentTarget.checked })}
          type="checkbox"
        />
        <span>Visible in panorama</span>
      </label>
      <TooltipFields
        onChange={onChange}
        tooltip={polygon.tooltip ?? {}}
        tooltipOffset={polygon.tooltipOffset ?? 12}
        tooltipPlacement={polygon.tooltipPlacement ?? "top"}
        tooltipTrigger={polygon.tooltipTrigger ?? "always"}
      />
      <div className="polygon-vertices" aria-label="Polygon vertices">
        {polygon.vertices.map((vertex, index) => (
          <span key={`${polygon.id}-position-${index}`}>V{index + 1} · {formatPosition(vertex)}</span>
        ))}
      </div>
      <button className="delete-button" onClick={onDelete} type="button">
        Delete polygon
      </button>
    </div>
  );
}
