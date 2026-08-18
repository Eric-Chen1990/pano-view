import type { EditorHotspot } from "../../../types";
import {
  checkboxLabelClassName,
  fieldClassName,
  fieldGridClassName,
  fieldInputClassName,
  fieldLabelClassName,
  fieldWideClassName,
  mediaActionClassName,
} from "../../../ui";
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
    <div className="grid gap-1.5">
      <button
        className={mediaActionClassName}
        onClick={() => onChange({ playing: !hotspot.playing })}
        type="button"
      >
        {hotspot.playing ? "Pause sequence" : "Play sequence"}
      </button>
      <label className={fieldWideClassName}>
        <span className={fieldLabelClassName}>Sprite sheet URL</span>
        <input
          className={fieldInputClassName}
          onChange={(event) => onChange({ src: event.currentTarget.value })}
          value={hotspot.src}
        />
      </label>
      <div className={fieldGridClassName}>
        <label className={fieldClassName}>
          <span className={fieldLabelClassName}>Frame count</span>
          <input
            className={fieldInputClassName}
            min="1"
            onChange={(event) =>
              onChange({ frameCount: numberValue(event.currentTarget.value, hotspot.frameCount) })
            }
            step="1"
            type="number"
            value={hotspot.frameCount}
          />
        </label>
        <label className={fieldClassName}>
          <span className={fieldLabelClassName}>Frames per second</span>
          <input
            className={fieldInputClassName}
            min="0.1"
            onChange={(event) => onChange({ fps: numberValue(event.currentTarget.value, hotspot.fps) })}
            step="0.1"
            type="number"
            value={hotspot.fps}
          />
        </label>
      </div>
      <label className={fieldWideClassName}>
        <span className={fieldLabelClassName}>Frame direction</span>
        <select
          className={fieldInputClassName}
          onChange={(event) =>
            onChange({
              frameDirection: event.currentTarget.value as "horizontal" | "vertical",
            })
          }
          value={hotspot.frameDirection}
        >
          <option value="vertical">Top to bottom</option>
          <option value="horizontal">Left to right</option>
        </select>
      </label>
      <label className={checkboxLabelClassName}>
        <input
          className="accent-[#df6b42]"
          checked={hotspot.loop}
          onChange={(event) => onChange({ loop: event.currentTarget.checked })}
          type="checkbox"
        />
        <span>Loop sequence</span>
      </label>
    </div>
  );
}
