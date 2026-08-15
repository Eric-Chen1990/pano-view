import type { EditorPolyline } from "../../../types";
import { formatPosition, numberValue } from "../../../utils";

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
    <div className="inspector-content">
      <label className="field wide">
        <span>Accessible label</span>
        <input onChange={(event) => onChange({ label: event.currentTarget.value })} value={polyline.label} />
      </label>
      <div className="field-grid">
        <label className="field">
          <span>Stroke</span>
          <input onChange={(event) => onChange({ stroke: event.currentTarget.value })} type="color" value={polyline.stroke} />
        </label>
        <label className="field">
          <span>Stroke width (px)</span>
          <input
            min="0.5"
            onChange={(event) => onChange({ strokeWidth: numberValue(event.currentTarget.value, polyline.strokeWidth) })}
            step="0.5"
            type="number"
            value={polyline.strokeWidth}
          />
        </label>
      </div>
      <label className="field wide range-field">
        <span>Stroke opacity <b>{Math.round(polyline.strokeOpacity * 100)}%</b></span>
        <input
          max="1"
          min="0"
          onChange={(event) => onChange({ strokeOpacity: numberValue(event.currentTarget.value, polyline.strokeOpacity) })}
          step="0.05"
          type="range"
          value={polyline.strokeOpacity}
        />
      </label>
      <label className="check-field">
        <input
          checked={polyline.visible}
          onChange={(event) => onChange({ visible: event.currentTarget.checked })}
          type="checkbox"
        />
        <span>Visible in panorama</span>
      </label>
      <div className="polygon-vertices" aria-label="Polyline vertices">
        {polyline.vertices.map((vertex, index) => (
          <span key={`${polyline.id}-position-${index}`}>V{index + 1} · {formatPosition(vertex)}</span>
        ))}
      </div>
      <button className="delete-button" onClick={onDelete} type="button">
        Delete polyline
      </button>
    </div>
  );
}
