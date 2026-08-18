import type { TextHotspotFontStyle } from "@ericchen1990/pano-view";
import type { EditorHotspot } from "../../../types";
import { numberValue } from "../../../utils";

const FONT_FAMILY_PRESETS = [
  { label: "System UI", value: "system-ui, sans-serif" },
  { label: "Inter", value: "Inter, ui-sans-serif, system-ui, sans-serif" },
  { label: "Georgia", value: 'Georgia, "Times New Roman", serif' },
  { label: "Monospace", value: "ui-monospace, SFMono-Regular, Consolas, monospace" },
  { label: "Chinese Gothic", value: '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif' },
] as const;

const FONT_WEIGHT_PRESETS = [
  { label: "Regular", value: 400 },
  { label: "Medium", value: 500 },
  { label: "Semibold", value: 600 },
  { label: "Bold", value: 700 },
] as const;

export function TextFields({
  hotspot,
  onChange,
}: {
  hotspot: Extract<EditorHotspot, { type: "text" }>;
  onChange: (
    patch: Partial<Omit<Extract<EditorHotspot, { type: "text" }>, "id" | "type">>,
  ) => void;
}) {
  const knownFontFamily = FONT_FAMILY_PRESETS.some(
    (preset) => preset.value === hotspot.fontFamily,
  );
  const knownFontWeight = FONT_WEIGHT_PRESETS.some(
    (preset) => preset.value === hotspot.fontWeight,
  );

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
      <label className="field wide">
        <span>Font family</span>
        <select
          onChange={(event) => onChange({ fontFamily: event.currentTarget.value })}
          value={hotspot.fontFamily}
        >
          {knownFontFamily ? null : (
            <option value={hotspot.fontFamily}>{hotspot.fontFamily}</option>
          )}
          {FONT_FAMILY_PRESETS.map((preset) => (
            <option key={preset.value} value={preset.value}>
              {preset.label}
            </option>
          ))}
        </select>
      </label>
      <div className="field-grid">
        <label className="field">
          <span>Weight</span>
          <select
            onChange={(event) => onChange({
              fontWeight: numberValue(event.currentTarget.value, hotspot.fontWeight),
            })}
            value={hotspot.fontWeight}
          >
            {knownFontWeight ? null : (
              <option value={hotspot.fontWeight}>{hotspot.fontWeight}</option>
            )}
            {FONT_WEIGHT_PRESETS.map((preset) => (
              <option key={preset.value} value={preset.value}>
                {preset.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Style</span>
          <select
            onChange={(event) => onChange({
              fontStyle: event.currentTarget.value as TextHotspotFontStyle,
            })}
            value={hotspot.fontStyle}
          >
            <option value="normal">Normal</option>
            <option value="italic">Italic</option>
          </select>
        </label>
      </div>
      <label className="field wide range-field">
        <span>Font size <b>{Math.round(hotspot.fontSize)}px</b></span>
        <input
          max="256"
          min="24"
          onChange={(event) => onChange({
            fontSize: numberValue(event.currentTarget.value, hotspot.fontSize),
          })}
          step="1"
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
