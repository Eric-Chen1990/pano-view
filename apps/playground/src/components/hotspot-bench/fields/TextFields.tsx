import type { EditorHotspot } from "../../../types";
import { numberValue } from "../../../utils";

export function TextFields({
  hotspot,
  onChange,
}: {
  hotspot: Extract<EditorHotspot, { type: "text" }>;
  onChange: (
    patch: Partial<Omit<Extract<EditorHotspot, { type: "text" }>, "id" | "type">>,
  ) => void;
}) {
  return (
    <div className="graphic-fields">
      <label className="field wide">
        <span>Text</span>
        <textarea
          onChange={(event) => onChange({ text: event.currentTarget.value })}
          rows={3}
          value={hotspot.text}
        />
      </label>
      <label className="field wide range-field">
        <span>Font size <b>{Math.round(hotspot.fontSize * 100)}%</b></span>
        <input
          max="0.4"
          min="0.06"
          onChange={(event) => onChange({
            fontSize: numberValue(event.currentTarget.value, hotspot.fontSize),
          })}
          step="0.01"
          type="range"
          value={hotspot.fontSize}
        />
      </label>
      <div className="field-grid">
        <label className="field">
          <span>Text color</span>
          <input
            onChange={(event) => onChange({ color: event.currentTarget.value })}
            type="color"
            value={hotspot.color}
          />
        </label>
        <label className="field">
          <span>Background</span>
          <input
            onChange={(event) => onChange({ background: event.currentTarget.value })}
            type="color"
            value={hotspot.background}
          />
        </label>
      </div>
      <label className="field wide range-field">
        <span>Background opacity <b>{Math.round(hotspot.backgroundOpacity * 100)}%</b></span>
        <input
          max="1"
          min="0"
          onChange={(event) => onChange({
            backgroundOpacity: numberValue(event.currentTarget.value, hotspot.backgroundOpacity),
          })}
          step="0.05"
          type="range"
          value={hotspot.backgroundOpacity}
        />
      </label>
      <div className="field-grid">
        <label className="field">
          <span>Align</span>
          <select
            onChange={(event) => onChange({
              align: event.currentTarget.value as Extract<EditorHotspot, { type: "text" }>["align"],
            })}
            value={hotspot.align}
          >
            <option value="left">Left</option>
            <option value="center">Center</option>
            <option value="right">Right</option>
          </select>
        </label>
        <label className="field">
          <span>Vertical</span>
          <select
            onChange={(event) => onChange({
              verticalAlign: event.currentTarget.value as Extract<
                EditorHotspot,
                { type: "text" }
              >["verticalAlign"],
            })}
            value={hotspot.verticalAlign}
          >
            <option value="top">Top</option>
            <option value="middle">Middle</option>
            <option value="bottom">Bottom</option>
          </select>
        </label>
      </div>
      <label className="field wide">
        <span>Wrapping</span>
        <select
          onChange={(event) => onChange({
            whiteSpace: event.currentTarget.value as Extract<
              EditorHotspot,
              { type: "text" }
            >["whiteSpace"],
          })}
          value={hotspot.whiteSpace}
        >
          <option value="normal">Wrap to width</option>
          <option value="nowrap">Single line</option>
        </select>
      </label>
    </div>
  );
}
