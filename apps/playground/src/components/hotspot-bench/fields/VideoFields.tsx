import type { EditorHotspot } from "../../../types";
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
    <div className="graphic-fields">
      <button
        className="media-action"
        onClick={() => onChange({ playing: !hotspot.playing })}
        type="button"
      >
        {hotspot.playing ? "Pause video" : "Play video"}
      </button>
      <label className="field wide">
        <span>Video URL</span>
        <input onChange={(event) => onChange({ src: event.currentTarget.value })} value={hotspot.src} />
      </label>
      <label className="field wide">
        <span>Poster URL</span>
        <input onChange={(event) => onChange({ poster: event.currentTarget.value })} value={hotspot.poster} />
      </label>
      <label className="field wide range-field">
        <span>Volume <b>{Math.round(hotspot.volume * 100)}%</b></span>
        <input
          max="1"
          min="0"
          onChange={(event) => onChange({ volume: numberValue(event.currentTarget.value, hotspot.volume) })}
          step="0.05"
          type="range"
          value={hotspot.volume}
        />
      </label>
      <div className="media-checks">
        <label className="check-field">
          <input checked={hotspot.loop} onChange={(event) => onChange({ loop: event.currentTarget.checked })} type="checkbox" />
          <span>Loop video</span>
        </label>
        <label className="check-field">
          <input checked={hotspot.muted} onChange={(event) => onChange({ muted: event.currentTarget.checked })} type="checkbox" />
          <span>Muted</span>
        </label>
      </div>
    </div>
  );
}
