import type { IframePointerPolicy } from "@ericchen1990/pano-view";
import type { EditorHotspot } from "../../../types";
import {
  fieldInputClassName,
  fieldLabelClassName,
  fieldWideClassName,
} from "../../../ui";

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
    <div className="grid gap-1.5">
      <label className={fieldWideClassName}>
        <span className={fieldLabelClassName}>Document URL</span>
        <input
          className={fieldInputClassName}
          onChange={(event) => onChange({ src: event.currentTarget.value })}
          value={hotspot.src}
        />
      </label>
      <label className={fieldWideClassName}>
        <span className={fieldLabelClassName}>Frame title</span>
        <input
          className={fieldInputClassName}
          onChange={(event) => onChange({ title: event.currentTarget.value })}
          value={hotspot.title}
        />
      </label>
      <label className={fieldWideClassName}>
        <span className={fieldLabelClassName}>Pointer policy</span>
        <select
          className={fieldInputClassName}
          onChange={(event) =>
            onChange({
              pointerPolicy: event.currentTarget.value as IframePointerPolicy,
            })
          }
          value={hotspot.pointerPolicy}
        >
          <option value="hotspot">Hotspot (drag / click plane)</option>
          <option value="content">Content (interact with page)</option>
        </select>
      </label>
      <label className={fieldWideClassName}>
        <span className={fieldLabelClassName}>Sandbox</span>
        <input
          className={fieldInputClassName}
          onChange={(event) => onChange({ sandbox: event.currentTarget.value })}
          value={hotspot.sandbox}
        />
      </label>
    </div>
  );
}
