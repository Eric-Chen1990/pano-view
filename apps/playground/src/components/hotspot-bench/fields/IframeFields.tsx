import type { IframePointerPolicy } from "@ericchen1990/pano-view";
import type { EditorHotspot } from "../../../types";

export function IframeFields({
  hotspot,
  onChange,
}: {
  hotspot: Extract<EditorHotspot, { type: "iframe" }>;
  onChange: (
    patch: Partial<Omit<Extract<EditorHotspot, { type: "iframe" }>, "id" | "type">>,
  ) => void;
}) {
  return (
    <div className="graphic-fields">
      <label className="field wide">
        <span>Document URL</span>
        <input
          onChange={(event) => onChange({ src: event.currentTarget.value })}
          value={hotspot.src}
        />
      </label>
      <label className="field wide">
        <span>Frame title</span>
        <input
          onChange={(event) => onChange({ title: event.currentTarget.value })}
          value={hotspot.title}
        />
      </label>
      <label className="field wide">
        <span>Pointer policy</span>
        <select
          onChange={(event) => onChange({
            pointerPolicy: event.currentTarget.value as IframePointerPolicy,
          })}
          value={hotspot.pointerPolicy}
        >
          <option value="hotspot">Hotspot (drag / click plane)</option>
          <option value="content">Content (interact with page)</option>
        </select>
      </label>
      <label className="field wide">
        <span>Sandbox</span>
        <input
          onChange={(event) => onChange({ sandbox: event.currentTarget.value })}
          value={hotspot.sandbox}
        />
      </label>
    </div>
  );
}
