import type { EditorHotspot } from "../../../types";
import { numberValue } from "../../../utils";

export function SequenceFields({
  hotspot,
  onChange,
}: {
  hotspot: Extract<EditorHotspot, { type: "sequence" }>;
  onChange: (
    patch: Partial<Omit<Extract<EditorHotspot, { type: "sequence" }>, "id" | "type">>,
  ) => void;
}) {
  return (
    <div className="graphic-fields">
      <button
        className="media-action"
        onClick={() => onChange({ playing: !hotspot.playing })}
        type="button"
      >
        {hotspot.playing ? "Pause sequence" : "Play sequence"}
      </button>
      <label className="field wide">
        <span>Sprite sheet URL</span>
        <input onChange={(event) => onChange({ src: event.currentTarget.value })} value={hotspot.src} />
      </label>
      <div className="field-grid">
        <label className="field">
          <span>Frame count</span>
          <input
            min="1"
            onChange={(event) => onChange({ frameCount: numberValue(event.currentTarget.value, hotspot.frameCount) })}
            step="1"
            type="number"
            value={hotspot.frameCount}
          />
        </label>
        <label className="field">
          <span>Frames per second</span>
          <input
            min="0.1"
            onChange={(event) => onChange({ fps: numberValue(event.currentTarget.value, hotspot.fps) })}
            step="0.1"
            type="number"
            value={hotspot.fps}
          />
        </label>
      </div>
      <label className="field wide">
        <span>Frame direction</span>
        <select
          onChange={(event) => onChange({ frameDirection: event.currentTarget.value as "horizontal" | "vertical" })}
          value={hotspot.frameDirection}
        >
          <option value="vertical">Top to bottom</option>
          <option value="horizontal">Left to right</option>
        </select>
      </label>
      <label className="check-field">
        <input checked={hotspot.loop} onChange={(event) => onChange({ loop: event.currentTarget.checked })} type="checkbox" />
        <span>Loop sequence</span>
      </label>
    </div>
  );
}
