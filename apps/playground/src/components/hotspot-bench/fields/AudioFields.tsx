import type { EditorHotspot } from "../../../types";
import {
  checkboxLabelClassName,
  fieldInputClassName,
  fieldLabelClassName,
  fieldWideClassName,
  mediaActionClassName,
} from "../../../ui";
import { numberValue } from "../../../utils";

export function AudioFields({
  hotspot,
  onChange,
}: {
  hotspot: Extract<EditorHotspot, { type: "audio" }>;
  onChange: (
    patch: Partial<Omit<Extract<EditorHotspot, { type: "audio" }>, "id" | "type">>,
  ) => void;
}) {
  return (
    <div className="grid gap-1.5">
      <button
        className={mediaActionClassName}
        onClick={() => onChange({ playing: !hotspot.playing })}
        type="button"
      >
        {hotspot.playing ? "Pause audio" : "Play audio"}
      </button>
      <label className={fieldWideClassName}>
        <span className={fieldLabelClassName}>Audio URL</span>
        <input
          className={fieldInputClassName}
          onChange={(event) => onChange({ src: event.currentTarget.value })}
          value={hotspot.src}
        />
      </label>
      <label className={fieldWideClassName}>
        <span className={fieldLabelClassName}>Icon URL</span>
        <input
          className={fieldInputClassName}
          onChange={(event) => onChange({ icon: event.currentTarget.value })}
          placeholder="Built-in speaker"
          value={hotspot.icon}
        />
      </label>
      <label className={fieldWideClassName}>
        <span className={`${fieldLabelClassName} flex justify-between`}>
          Volume
          <b className="font-mono text-[0.61rem] font-normal text-[#dcecef]">
            {Math.round(hotspot.volume * 100)}%
          </b>
        </span>
        <input
          className="accent-[#df6b42]"
          max="1"
          min="0"
          onChange={(event) =>
            onChange({ volume: numberValue(event.currentTarget.value, hotspot.volume) })
          }
          step="0.05"
          type="range"
          value={hotspot.volume}
        />
      </label>
      <label className={fieldWideClassName}>
        <span className={`${fieldLabelClassName} flex justify-between`}>
          Look-away range
          <b className="font-mono text-[0.61rem] font-normal text-[#dcecef]">
            {Math.round(hotspot.range)}°
          </b>
        </span>
        <input
          className="accent-[#df6b42]"
          max="360"
          min="1"
          onChange={(event) =>
            onChange({ range: numberValue(event.currentTarget.value, hotspot.range) })
          }
          step="1"
          type="range"
          value={hotspot.range}
        />
      </label>
      <div className="grid gap-[9px]">
        <label className={checkboxLabelClassName}>
          <input
            className="accent-[#df6b42]"
            checked={hotspot.loop}
            onChange={(event) => onChange({ loop: event.currentTarget.checked })}
            type="checkbox"
          />
          <span>Loop audio</span>
        </label>
        <label className={checkboxLabelClassName}>
          <input
            className="accent-[#df6b42]"
            checked={hotspot.muted}
            onChange={(event) => onChange({ muted: event.currentTarget.checked })}
            type="checkbox"
          />
          <span>Muted</span>
        </label>
        <label className={checkboxLabelClassName}>
          <input
            className="accent-[#df6b42]"
            checked={hotspot.pauseWhenHidden}
            onChange={(event) => onChange({ pauseWhenHidden: event.currentTarget.checked })}
            type="checkbox"
          />
          <span>Pause when tab hidden</span>
        </label>
        <label className={checkboxLabelClassName}>
          <input
            className="accent-[#df6b42]"
            checked={hotspot.marker}
            onChange={(event) => onChange({ marker: event.currentTarget.checked })}
            type="checkbox"
          />
          <span>Show marker</span>
        </label>
      </div>
    </div>
  );
}
