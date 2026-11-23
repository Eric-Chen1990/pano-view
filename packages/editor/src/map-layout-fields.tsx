import {
  isOverlayCorner,
  PANO_OVERLAY_ALIGNS,
  type PanoMapPresentation,
  type PanoOverlayAlign,
  type PanoOverlayAxis,
  type PanoOverlayInset,
} from "@ericchen1990/pano-view";
import type { Translate } from "./i18n";
import { SizeField } from "./size-field";

const DEFAULT_INSET = 16;

type InsetSide = "top" | "right" | "bottom" | "left";

function insetSides(align: PanoOverlayAlign): readonly InsetSide[] {
  switch (align) {
    case "top":
      return ["top"];
    case "bottom":
      return ["bottom"];
    case "left":
      return ["left"];
    case "right":
      return ["right"];
    case "top-left":
      return ["top", "left"];
    case "top-right":
      return ["top", "right"];
    case "bottom-left":
      return ["bottom", "left"];
    case "bottom-right":
      return ["bottom", "right"];
    default: {
      const exhaustive: never = align;
      return exhaustive;
    }
  }
}

function insetNumber(inset: PanoOverlayInset | undefined, side: InsetSide): number {
  if (typeof inset === "number") return inset;
  if (inset && typeof inset === "object") {
    const value = inset[side];
    if (typeof value === "number") return value;
  }
  return DEFAULT_INSET;
}

function withInset(
  inset: PanoOverlayInset | undefined,
  side: InsetSide,
  value: number,
): PanoOverlayInset {
  const base =
    typeof inset === "number"
      ? { top: inset, right: inset, bottom: inset, left: inset }
      : inset && typeof inset === "object"
        ? { ...inset }
        : {};
  return { ...base, [side]: value };
}

const INSET_LABEL: Record<InsetSide, string> = {
  top: "Top inset (px)",
  right: "Right inset (px)",
  bottom: "Bottom inset (px)",
  left: "Left inset (px)",
};

export function MapLayoutFields({
  presentation,
  collapse,
  sizeSemantics,
  widthFallback,
  heightFallback,
  onChange,
  t,
}: {
  presentation: PanoMapPresentation;
  collapse?: boolean;
  /** Floor-plan dialog sizes the launcher; online-map dialog sizes the dialog body. */
  sizeSemantics: "panel" | "launcher" | "dialog";
  widthFallback: number;
  heightFallback: number;
  onChange: (presentation: PanoMapPresentation) => void;
  t: Translate;
}) {
  const align = presentation.anchor?.align ?? "bottom-left";
  const axis = presentation.anchor?.axis ?? "horizontal";
  const widthLabel =
    sizeSemantics === "launcher"
      ? t("Launcher width")
      : sizeSemantics === "dialog"
        ? t("Dialog width")
        : t("Width");
  const heightLabel =
    sizeSemantics === "launcher"
      ? t("Launcher height")
      : sizeSemantics === "dialog"
        ? t("Dialog height")
        : t("Height");

  return (
    <>
      <p className="pne-field-help">
        {t("Panel size applies in preview and on the published tour. Editing uses a larger authoring surface.")}
      </p>
      <label>
        <span>{t("Presentation")}</span>
        <select
          value={presentation.mode}
          onChange={(event) =>
            onChange({
              ...presentation,
              mode: event.target.value as "panel" | "dialog",
            })
          }
        >
          <option value="panel">{t("Panel")}</option>
          <option value="dialog">{t("Dialog button")}</option>
        </select>
      </label>
      <label>
        <span>{t("Screen align")}</span>
        <select
          value={align}
          onChange={(event) =>
            onChange({
              ...presentation,
              anchor: {
                ...presentation.anchor,
                align: event.target.value as PanoOverlayAlign,
              },
            })
          }
        >
          {PANO_OVERLAY_ALIGNS.map((value) => (
            <option key={value} value={value}>
              {t(value)}
            </option>
          ))}
        </select>
      </label>
      {insetSides(align).map((side) => (
        <label key={side}>
          <span>{t(INSET_LABEL[side])}</span>
          <input
            type="number"
            min={0}
            value={insetNumber(presentation.anchor?.inset, side)}
            onChange={(event) =>
              onChange({
                ...presentation,
                anchor: {
                  ...presentation.anchor,
                  inset: withInset(
                    presentation.anchor?.inset,
                    side,
                    Number(event.target.value),
                  ),
                },
              })
            }
          />
        </label>
      ))}
      <SizeField
        label={widthLabel}
        value={presentation.width}
        fallbackPx={widthFallback}
        onChange={(width) => onChange({ ...presentation, width })}
        t={t}
      />
      <SizeField
        label={heightLabel}
        value={presentation.height}
        fallbackPx={heightFallback}
        onChange={(height) => onChange({ ...presentation, height })}
        t={t}
      />
      {presentation.mode === "panel" &&
      isOverlayCorner(align) &&
      collapse === true ? (
        <label>
          <span>{t("Axis")}</span>
          <select
            value={axis}
            onChange={(event) =>
              onChange({
                ...presentation,
                anchor: {
                  ...presentation.anchor,
                  axis: event.target.value as PanoOverlayAxis,
                },
              })
            }
          >
            <option value="horizontal">{t("Horizontal")}</option>
            <option value="vertical">{t("Vertical")}</option>
          </select>
        </label>
      ) : null}
    </>
  );
}

export { DEFAULT_INSET };
