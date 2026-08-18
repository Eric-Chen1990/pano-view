import {
  DEFAULT_HOTSPOT_TOOLTIP_APPEARANCE,
  type HotspotTooltipAppearance,
  type HotspotTooltipContent,
  type HotspotTooltipPlacement,
  type HotspotTooltipTrigger,
} from "@ericchen1990/pano-view";
import {
  fieldClassName,
  fieldGridClassName,
  fieldInputClassName,
  fieldLabelClassName,
  fieldWideClassName,
} from "../../../ui";
import {
  colorToHex,
  composeBorder,
  composeRgba,
  composeShadow,
  numberValue,
  parseBorder,
  parseCssColor,
  parseRgba,
  parseShadow,
} from "../../../utils";

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

function resolveAppearance(
  appearance: HotspotTooltipAppearance | undefined,
): Required<HotspotTooltipAppearance> {
  return { ...DEFAULT_HOTSPOT_TOOLTIP_APPEARANCE, ...appearance };
}

function updateAppearance(
  appearance: HotspotTooltipAppearance | undefined,
  patch: Partial<HotspotTooltipAppearance>,
): HotspotTooltipAppearance {
  return { ...resolveAppearance(appearance), ...patch };
}

export function TooltipFields({
  tooltip,
  tooltipTrigger,
  tooltipPlacement,
  tooltipOffset,
  tooltipAppearance,
  onChange,
}: {
  tooltip: HotspotTooltipContent;
  tooltipTrigger: HotspotTooltipTrigger;
  tooltipPlacement: HotspotTooltipPlacement;
  tooltipOffset: number;
  tooltipAppearance?: HotspotTooltipAppearance;
  onChange: (patch: {
    tooltip?: HotspotTooltipContent;
    tooltipTrigger?: HotspotTooltipTrigger;
    tooltipPlacement?: HotspotTooltipPlacement;
    tooltipOffset?: number;
    tooltipAppearance?: HotspotTooltipAppearance;
  }) => void;
}) {
  const appearance = resolveAppearance(tooltipAppearance);
  const backgroundColor = parseCssColor(appearance.background);
  const backgroundHex = backgroundColor
    ? colorToHex(appearance.background, "#161616")
    : "#161616";
  const backgroundOpacity = backgroundColor?.a ?? 0.72;
  const border = parseBorder(appearance.border);
  const borderHex = colorToHex(border.color, "#2e2e2e");
  const shadow = parseShadow(appearance.shadow);
  const borderRadius =
    typeof appearance.borderRadius === "number"
      ? appearance.borderRadius
      : Number.parseFloat(String(appearance.borderRadius)) || 8;
  const padding =
    typeof appearance.padding === "number"
      ? appearance.padding
      : Number.parseFloat(String(appearance.padding)) || 8;

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

      <div className="col-span-full grid gap-2.5 border-t border-[#27454d] pt-[11px]">
        <p className="text-[0.67rem] uppercase tracking-[0.08em] text-[#88a6ac]">
          Tooltip appearance
        </p>
        <div className={fieldGridClassName}>
          <label className={fieldClassName}>
            <span className={fieldLabelClassName}>Background</span>
            <input
              className="h-[34px] border border-[#38545b] bg-[#08191d] p-[3px]"
              onChange={(event) => {
                const parsed = parseCssColor(event.currentTarget.value);
                if (!parsed) {
                  return;
                }
                onChange({
                  tooltipAppearance: updateAppearance(tooltipAppearance, {
                    background: composeRgba({ ...parsed, a: backgroundOpacity }),
                  }),
                });
              }}
              type="color"
              value={backgroundHex}
            />
          </label>
          <label className={fieldClassName}>
            <span className={`${fieldLabelClassName} flex justify-between`}>
              Background opacity
              <b className="font-mono text-[0.61rem] font-normal text-[#dcecef]">
                {Math.round(backgroundOpacity * 100)}%
              </b>
            </span>
            <input
              className="accent-[#df6b42]"
              max="1"
              min="0"
              onChange={(event) => {
                const opacity = numberValue(event.currentTarget.value, backgroundOpacity);
                const parsed = parseCssColor(backgroundHex) ?? {
                  r: 22,
                  g: 22,
                  b: 22,
                  a: 1,
                };
                onChange({
                  tooltipAppearance: updateAppearance(tooltipAppearance, {
                    background: composeRgba({ ...parsed, a: opacity }),
                  }),
                });
              }}
              step="0.05"
              type="range"
              value={backgroundOpacity}
            />
          </label>
        </div>
        <label className={fieldWideClassName}>
          <span className={fieldLabelClassName}>Text color</span>
          <input
            className="h-[34px] border border-[#38545b] bg-[#08191d] p-[3px]"
            onChange={(event) =>
              onChange({
                tooltipAppearance: updateAppearance(tooltipAppearance, {
                  color: event.currentTarget.value,
                }),
              })
            }
            type="color"
            value={colorToHex(appearance.color, "#f5fbfc")}
          />
        </label>
        <div className={fieldGridClassName}>
          <label className={fieldClassName}>
            <span className={fieldLabelClassName}>Border color</span>
            <input
              className="h-[34px] border border-[#38545b] bg-[#08191d] p-[3px]"
              onChange={(event) => {
                const parsed = parseCssColor(border.color) ?? parseRgba(border.color);
                const opacity = parsed?.a ?? 0.7;
                const rgb = parseCssColor(event.currentTarget.value);
                if (!rgb) {
                  return;
                }
                onChange({
                  tooltipAppearance: updateAppearance(tooltipAppearance, {
                    border: composeBorder(border.width, composeRgba({ ...rgb, a: opacity })),
                  }),
                });
              }}
              type="color"
              value={borderHex}
            />
          </label>
          <label className={fieldClassName}>
            <span className={fieldLabelClassName}>Border width (px)</span>
            <input
              className={fieldInputClassName}
              min="0"
              onChange={(event) =>
                onChange({
                  tooltipAppearance: updateAppearance(tooltipAppearance, {
                    border: composeBorder(
                      numberValue(event.currentTarget.value, border.width),
                      border.color,
                    ),
                  }),
                })
              }
              step="1"
              type="number"
              value={border.width}
            />
          </label>
        </div>
        <div className={fieldGridClassName}>
          <label className={fieldClassName}>
            <span className={fieldLabelClassName}>Radius (px)</span>
            <input
              className={fieldInputClassName}
              min="0"
              onChange={(event) =>
                onChange({
                  tooltipAppearance: updateAppearance(tooltipAppearance, {
                    borderRadius: numberValue(event.currentTarget.value, borderRadius),
                  }),
                })
              }
              step="1"
              type="number"
              value={borderRadius}
            />
          </label>
          <label className={fieldClassName}>
            <span className={fieldLabelClassName}>Padding (px)</span>
            <input
              className={fieldInputClassName}
              min="0"
              onChange={(event) =>
                onChange({
                  tooltipAppearance: updateAppearance(tooltipAppearance, {
                    padding: numberValue(event.currentTarget.value, padding),
                  }),
                })
              }
              step="1"
              type="number"
              value={padding}
            />
          </label>
        </div>
        <div className={fieldGridClassName}>
          <label className={fieldClassName}>
            <span className={fieldLabelClassName}>Shadow color</span>
            <input
              className="h-[34px] border border-[#38545b] bg-[#08191d] p-[3px]"
              onChange={(event) =>
                onChange({
                  tooltipAppearance: updateAppearance(tooltipAppearance, {
                    shadow: composeShadow(shadow.blur, event.currentTarget.value, shadow.opacity),
                  }),
                })
              }
              type="color"
              value={shadow.color}
            />
          </label>
          <label className={fieldClassName}>
            <span className={`${fieldLabelClassName} flex justify-between`}>
              Shadow blur (px)
              <b className="font-mono text-[0.61rem] font-normal text-[#dcecef]">
                {Math.round(shadow.blur)}
              </b>
            </span>
            <input
              className="accent-[#df6b42]"
              max="48"
              min="0"
              onChange={(event) =>
                onChange({
                  tooltipAppearance: updateAppearance(tooltipAppearance, {
                    shadow: composeShadow(
                      numberValue(event.currentTarget.value, shadow.blur),
                      shadow.color,
                      shadow.opacity,
                    ),
                  }),
                })
              }
              step="1"
              type="range"
              value={shadow.blur}
            />
          </label>
        </div>
      </div>
    </>
  );
}
