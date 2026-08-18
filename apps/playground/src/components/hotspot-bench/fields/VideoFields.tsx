import type { EditorHotspot } from "../../../types";
import {
  checkboxLabelClassName,
  fieldInputClassName,
  fieldLabelClassName,
  fieldWideClassName,
  mediaActionClassName,
} from "../../../ui";
import { numberValue } from "../../../utils";

export function VideoFields({
  hotspot,
  onChange,
}: {
  hotspot: Extract<EditorHotspot, { type: "video" }>;
  onChange: (
    patch: Partial<Omit<Extract<EditorHotspot, { type: "video" }>, "id" | "type">>,
  ) => void;
}) {
  return (
    <div className="grid gap-1.5">
      <button
        className={mediaActionClassName}
        onClick={() => onChange({ playing: !hotspot.playing })}
        type="button"
      >
        {hotspot.playing ? "Pause video" : "Play video"}
      </button>
      <label className={fieldWideClassName}>
        <span className={fieldLabelClassName}>Video URL</span>
        <input
          className={fieldInputClassName}
          onChange={(event) => onChange({ src: event.currentTarget.value })}
          value={hotspot.src}
        />
      </label>
      <label className={fieldWideClassName}>
        <span className={fieldLabelClassName}>Poster URL</span>
        <input
          className={fieldInputClassName}
          onChange={(event) => onChange({ poster: event.currentTarget.value })}
          value={hotspot.poster}
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
      <div className="grid gap-[9px]">
        <label className={checkboxLabelClassName}>
          <input
            className="accent-[#df6b42]"
            checked={hotspot.loop}
            onChange={(event) => onChange({ loop: event.currentTarget.checked })}
            type="checkbox"
          />
          <span>Loop video</span>
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
      </div>
    </div>
  );
}
