import type {
  HotspotTooltipContent,
  HotspotTooltipPlacement,
  HotspotTooltipTrigger,
} from "@ericchen1990/pano-view";
import {
  fieldClassName,
  fieldGridClassName,
  fieldInputClassName,
  fieldLabelClassName,
  fieldWideClassName,
} from "../../../ui";
import { numberValue } from "../../../utils";

const TOOLTIP_TRIGGER_LABELS: Record<HotspotTooltipTrigger, string> = {
  always: "Always visible",
  hover: "Hover",
  click: "Click to pin",
};

const TOOLTIP_PLACEMENT_LABELS: Record<HotspotTooltipPlacement, string> = {
  top: "Top",
  bottom: "Bottom",
  left: "Left",
  right: "Right",
};

export function TooltipFields({
  tooltip,
  tooltipTrigger,
  tooltipPlacement,
  tooltipOffset,
  onChange,
}: {
  tooltip: HotspotTooltipContent;
  tooltipTrigger: HotspotTooltipTrigger;
  tooltipPlacement: HotspotTooltipPlacement;
  tooltipOffset: number;
  onChange: (patch: {
    tooltip?: HotspotTooltipContent;
    tooltipTrigger?: HotspotTooltipTrigger;
    tooltipPlacement?: HotspotTooltipPlacement;
    tooltipOffset?: number;
  }) => void;
}) {
  return (
    <>
      <label className={fieldWideClassName}>
        <span className={fieldLabelClassName}>Tooltip text</span>
        <input
          className={fieldInputClassName}
          onChange={(event) =>
            onChange({
              tooltip: { text: event.currentTarget.value },
            })
          }
          value={tooltip.text ?? ""}
        />
      </label>
      <div className={fieldGridClassName}>
        <label className={fieldClassName}>
          <span className={fieldLabelClassName}>Tooltip trigger</span>
          <select
            className={fieldInputClassName}
            onChange={(event) =>
              onChange({
                tooltipTrigger: event.currentTarget.value as HotspotTooltipTrigger,
              })
            }
            value={tooltipTrigger}
          >
            {(Object.keys(TOOLTIP_TRIGGER_LABELS) as HotspotTooltipTrigger[]).map((trigger) => (
              <option key={trigger} value={trigger}>
                {TOOLTIP_TRIGGER_LABELS[trigger]}
              </option>
            ))}
          </select>
        </label>
        <label className={fieldClassName}>
          <span className={fieldLabelClassName}>Tooltip placement</span>
          <select
            className={fieldInputClassName}
            onChange={(event) =>
              onChange({
                tooltipPlacement: event.currentTarget.value as HotspotTooltipPlacement,
              })
            }
            value={tooltipPlacement}
          >
            {(Object.keys(TOOLTIP_PLACEMENT_LABELS) as HotspotTooltipPlacement[]).map(
              (placement) => (
                <option key={placement} value={placement}>
                  {TOOLTIP_PLACEMENT_LABELS[placement]}
                </option>
              ),
            )}
          </select>
        </label>
      </div>
      <label className={fieldWideClassName}>
        <span className={fieldLabelClassName}>Tooltip gap (px)</span>
        <input
          className={fieldInputClassName}
          min="0"
          onChange={(event) =>
            onChange({
              tooltipOffset: numberValue(event.currentTarget.value, tooltipOffset),
            })
          }
          step="1"
          type="number"
          value={tooltipOffset}
        />
      </label>
    </>
  );
}
