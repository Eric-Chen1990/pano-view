import { useId, useState, type ReactNode } from "react";
import { FieldHelp } from "./field-help";
import { fieldValue } from "./hotspot-defaults";
import type { Translate } from "./i18n";
import { fieldLabel } from "./i18n";
import type { ProjectHotspotDefinition } from "@ericchen1990/pano-view";

export function getField(value: unknown, path: string): unknown {
  return path
    .split(".")
    .reduce<unknown>(
      (current, key) =>
        current && typeof current === "object"
          ? (current as Record<string, unknown>)[key]
          : undefined,
      value,
    );
}
export function setField<T>(value: T, path: string, next: unknown): T {
  const copy = structuredClone(value) as Record<string, unknown>;
  const keys = path.split(".");
  let current = copy;
  for (const key of keys.slice(0, -1)) {
    const child = current[key];
    current[key] = child && typeof child === "object" ? child : {};
    current = current[key] as Record<string, unknown>;
  }
  const key = keys[keys.length - 1]!;
  if (next === undefined) delete current[key];
  else current[key] = next;
  return copy as T;
}

export function setHotspotField(
  hotspot: ProjectHotspotDefinition,
  name: string,
  value: unknown,
): ProjectHotspotDefinition {
  if (name === "fontWeight" && typeof value === "string" && /^\d+$/.test(value))
    return setField(hotspot, name, Number(value));
  if (name === "tooltip.text")
    return setField(
      hotspot,
      "tooltip",
      typeof hotspot.tooltip === "object"
        ? { ...hotspot.tooltip, text: value as string | undefined }
        : value,
    );
  if (name.startsWith("tooltip.") && typeof hotspot.tooltip === "string")
    return setField(
      { ...hotspot, tooltip: { text: hotspot.tooltip } },
      name,
      value,
    );
  return setField(hotspot, name, value);
}

export type FieldSpec = {
  name: string;
  defaultValue?: unknown;
  type?: "number" | "boolean" | "lines" | "json" | "textarea";
  options?: string[];
  optionLabels?: Record<string, string>;
  label?: string;
  help?: string;
  asset?: boolean;
  number?: {
    min?: number;
    max?: number;
    exclusiveMin?: number;
    integer?: boolean;
    required?: boolean;
  };
};
/** Also checked before publishing; native number inputs alone do not enforce bounds. */
export function parseFieldInput(
  spec: FieldSpec,
  input: string,
  badInput = false
): unknown {
  if (badInput) throw new Error("Enter a valid number.");
  if (
    !input.trim() &&
    (spec.type === "number" ||
      spec.type === "json" ||
      spec.type === "lines" ||
      spec.options)
  ) {
    if (spec.number?.required) throw new Error("This number is required.");
    return undefined;
  }
  if (spec.options) {
    if (!spec.options.includes(input))
      throw new Error("Choose an available option.");
    return input;
  }
  if (spec.type === "number") {
    const next = Number(input);
    if (!Number.isFinite(next)) throw new Error("Enter a finite number.");
    const rule = spec.number;
    if (rule?.integer && !Number.isSafeInteger(next))
      throw new Error("Enter a whole number within the safe integer range.");
    if (rule?.exclusiveMin !== undefined && next <= rule.exclusiveMin)
      throw new Error("Enter a number greater than zero.");
    if (
      (rule?.min !== undefined && next < rule.min) ||
      (rule?.max !== undefined && next > rule.max)
    )
      throw new Error(
        rule.min === -90 && rule.max === 90
          ? "Enter a number from -90 to 90."
          : rule.min === 0 && rule.max === 1
            ? "Enter a number from 0 to 1."
            : "Enter a number within the allowed range."
      );
    return next;
  }
  return spec.type === "json"
    ? JSON.parse(input)
    : spec.type === "lines"
    ? input.split("\n").filter(Boolean)
    : input;
}

export function Field({
  spec,
  value,
  onChange,
  onBegin,
  onEnd,
  onPick,
  previewUrl,
  t,
}: {
  spec: FieldSpec;
  value: unknown;
  onChange: (value: unknown) => void;
  onBegin: () => void;
  onEnd: () => void;
  onPick?: () => void;
  previewUrl?: string;
  t: Translate;
}) {
  const id = useId();
  const descriptionId = `${id}-description`;
  const errorId = `${id}-error`;
  const resolvedValue = fieldValue(value, spec.defaultValue);
  const display = (item: unknown) =>
    item === undefined
      ? ""
      : spec.type === "json"
        ? JSON.stringify(item, null, 2)
        : Array.isArray(item)
          ? item.join("\n")
          : String(item);
  const [text, setText] = useState(() => display(resolvedValue));
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState("");
  const label = t(spec.label ?? fieldLabel(spec.name));
  const report = (cause: unknown) =>
    setError(t(cause instanceof Error ? cause.message : String(cause)));
  const apply = (input: string, badInput = false) => {
    setText(input);
    try {
      // Empty authoring drafts must not delete required values or flash the default while typing.
      if (spec.number && !input && !badInput) {
        setError(spec.number.required ? t("This number is required.") : "");
        return;
      }
      onChange(parseFieldInput(spec, input, badInput));
      setError("");
    } catch (cause) {
      report(cause);
    }
  };
  const accessibility = {
    id,
    "aria-invalid": Boolean(error),
    "aria-describedby":
      [spec.help ? descriptionId : "", error ? errorId : ""]
        .filter(Boolean)
        .join(" ") || undefined,
  };
  let control: ReactNode;
  if (spec.type === "boolean")
    control = (
      <input
        {...accessibility}
        type="checkbox"
        checked={resolvedValue === true}
        onChange={(event) => {
          try {
            onChange(event.currentTarget.checked);
            setError("");
          } catch (cause) {
            report(cause);
          }
        }}
      />
    );
  else if (spec.options)
    control = (
      <select
        {...accessibility}
        value={typeof resolvedValue === "string" ? resolvedValue : ""}
        onChange={(event) => apply(event.currentTarget.value)}
      >
        <option value="">
          {t(spec.name === "cursor" ? "Use viewer default" : spec.defaultValue === undefined ? "—" : "Use default")}
        </option>
        {spec.name === "cursor" && typeof resolvedValue === "string" && !spec.options.includes(resolvedValue) ? <option value={resolvedValue}>{t("Existing custom cursor")}</option> : null}
        {spec.options.map((option) => (
          <option key={option} value={option}>
            {t(spec.optionLabels?.[option] ?? option)}
          </option>
        ))}
      </select>
    );
  else {
    const props = {
      ...accessibility,
      value: editing ? text : display(resolvedValue),
      onFocus: () => {
        setText(display(resolvedValue));
        setEditing(true);
        onBegin();
      },
      onBlur: (
        event: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>
      ) => {
        try {
          if (
            spec.number &&
            !text &&
            !(
              event.currentTarget instanceof HTMLInputElement &&
              event.currentTarget.validity.badInput
            )
          )
            onChange(parseFieldInput(spec, text));
        } catch (cause) {
          report(cause);
        } finally {
          onEnd();
          setEditing(false);
          setText(display(resolvedValue));
          setError("");
        }
      },
      onChange: (
        event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
      ) =>
        apply(
          event.currentTarget.value,
          event.currentTarget instanceof HTMLInputElement &&
            event.currentTarget.validity.badInput
        ),
    };
    control =
      spec.type === "textarea" ||
      spec.type === "lines" ||
      spec.type === "json" ? (
        <textarea {...props} rows={spec.type === "json" ? 6 : 3} />
      ) : (
        <input
          {...props}
          type={spec.type === "number" ? "number" : "text"}
          min={spec.number?.min ?? spec.number?.exclusiveMin}
          max={spec.number?.max}
          step={
            spec.type === "number"
              ? spec.number?.integer
                ? 1
                : "any"
              : undefined
          }
          required={spec.number?.required}
        />
      );
  }
  return (
    <div className={`pne-field ${spec.type === "boolean" ? "pne-check" : ""}`}>
      <div className="pne-field-heading">
        <label htmlFor={id}>{label}</label>
        {spec.help ? (
          <FieldHelp
            id={`${id}-help`}
            label={label}
            name={spec.name}
            help={t(spec.help)}
            action={t("Field help")}
          />
        ) : null}
      </div>
      {control}
      {spec.help ? (
        <span id={descriptionId} className="pne-sr-only">
          {t(spec.help)}
        </span>
      ) : null}
      {value !== undefined &&
      spec.defaultValue !== undefined &&
      value !== spec.defaultValue ? (
        <button
          type="button"
          className="pne-subtle"
          aria-label={`${t("Use default")}: ${label}`}
          onClick={(event) => {
            try {
              event.currentTarget.parentElement
                ?.querySelector<HTMLElement>("input, select, textarea")
                ?.focus();
              onChange(undefined);
              setText(display(spec.defaultValue));
              setError("");
            } catch (cause) {
              report(cause);
            }
          }}
        >
          {t("Use default")}
        </button>
      ) : null}
      {previewUrl ? <img src={previewUrl} alt={t("Cursor image preview")} className="pne-cursor-preview" /> : null}
      {spec.asset && onPick ? (
        <button type="button" className="pne-subtle" onClick={onPick}>
          {t("Browse assets")}
        </button>
      ) : null}
      {error ? (
        <small id={errorId} role="alert">
          {error}
        </small>
      ) : null}
    </div>
  );
}

export const commonFields: FieldSpec[] = [
  {
    name: "label",
    label: "Hotspot name",
    help: "Used in the hotspot list and for accessibility. Not displayed in the panorama.",
  },
  { name: "visible", type: "boolean", defaultValue: true },
  { name: "interactive", type: "boolean", defaultValue: true },
  { name: "pointerEvents", options: ["auto", "none"] },
  { name: "renderOrder", type: "number" },
  { name: "cursor", asset: true, options: ["pointer", "default", "crosshair", "move", "grab", "help", "not-allowed", "none", "custom-image"], optionLabels: {
    pointer: "Hand pointer", default: "Arrow cursor", crosshair: "Crosshair", move: "Move cursor", grab: "Grab cursor", help: "Help cursor", "not-allowed": "Unavailable cursor", none: "Hide cursor", "custom-image": "Choose local cursor image…",
  } },
];
export const pointFields: FieldSpec[] = [
  ...[
    "position.yaw",
    "position.pitch",
    "width",
    "height",
    "scale",
    "rotation",
    "opacity",
    "distance",
    "referenceFov",
  ].map((name): FieldSpec => ({ name, type: "number" })),
  { name: "mode", options: ["surface", "billboard"] },
  { name: "scaleMode", options: ["fov", "fixed"] },
];
const source: FieldSpec = { name: "src", asset: true };
const booleans = (...names: string[]): FieldSpec[] =>
  names.map((name) => ({
    name,
    type: "boolean",
    defaultValue: ["playsInline", "marker", "pauseWhenHidden"].includes(name),
  }));
const numbers = (...names: string[]): FieldSpec[] =>
  names.map((name) => ({ name, type: "number" }));
const stroke: FieldSpec[] = [
  { name: "stroke" },
  ...numbers("strokeWidth", "strokeOpacity", "strokeDashSize", "strokeGapSize"),
];
export const contentFields: Record<string, FieldSpec[]> = {
  image: [source],
  graphic: [
    {
      name: "graphic.kind",
      options: [
        "circle",
        "triangle",
        "diamond",
        "star",
        "arrow",
        "rectangle",
        "ring",
        "svg",
        "path",
      ],
    },
  ],
  sequence: [
    source,
    ...numbers("frameCount", "fps"),
    { name: "frameDirection", options: ["horizontal", "vertical"] },
    ...booleans("playing", "loop"),
  ],
  video: [
    source,
    { name: "poster", asset: true },
    ...booleans("playing", "loop", "muted", "playsInline"),
    ...numbers("volume"),
    { name: "preload", options: ["none", "metadata", "auto"] },
    { name: "crossOrigin", options: ["anonymous", "use-credentials"] },
  ],
  audio: [
    { ...source, type: "lines" },
    { name: "format", type: "lines" },
    { name: "icon", asset: true },
    { name: "playingIcon", asset: true },
    ...numbers("volume", "range"),
    ...booleans("playing", "loop", "muted", "marker", "pauseWhenHidden"),
    { name: "crossOrigin", options: ["anonymous", "use-credentials"] },
  ],
  text: [
    { name: "text", label: "Scene text", type: "textarea" },
    { name: "fontFamily" },
    ...numbers("fontSize"),
    { name: "fontWeight" },
    { name: "fontStyle", options: ["normal", "italic"] },
    { name: "color" },
    { name: "background" },
    ...numbers("backgroundOpacity", "padding", "lineHeight", "borderRadius"),
    { name: "stroke" },
    ...numbers("strokeWidth"),
    { name: "align", options: ["left", "center", "right"] },
    { name: "verticalAlign", options: ["top", "middle", "bottom"] },
    { name: "whiteSpace", options: ["normal", "nowrap"] },
  ],
  iframe: [
    source,
    { name: "title" },
    { name: "sandbox" },
    { name: "allow" },
    {
      name: "referrerPolicy",
      options: [
        "no-referrer",
        "no-referrer-when-downgrade",
        "origin",
        "origin-when-cross-origin",
        "same-origin",
        "strict-origin",
        "strict-origin-when-cross-origin",
        "unsafe-url",
      ],
    },
    { name: "loading", options: ["eager", "lazy"] },
    { name: "pointerPolicy", options: ["hotspot", "content"] },
    { name: "background" },
  ],
  polygon: [{ name: "fill" }, ...numbers("fillOpacity"), ...stroke],
  polyline: stroke,
};
