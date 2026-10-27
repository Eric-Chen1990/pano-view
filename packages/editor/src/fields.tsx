import { useState, type ReactNode } from "react";
import type { Translate } from "./i18n";
import { fieldLabel } from "./i18n";

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

export type FieldSpec = {
  name: string;
  defaultValue?: unknown;
  type?: "number" | "boolean" | "lines" | "json" | "textarea";
  options?: string[];
  label?: string;
  asset?: boolean;
};
export function Field({
  spec,
  value,
  onChange,
  onBegin,
  onEnd,
  onPick,
  t,
}: {
  spec: FieldSpec;
  value: unknown;
  onChange: (value: unknown) => void;
  onBegin: () => void;
  onEnd: () => void;
  onPick?: () => void;
  t: Translate;
}) {
  const display = (item: unknown) =>
    item === undefined
      ? ""
      : spec.type === "json"
        ? JSON.stringify(item, null, 2)
        : Array.isArray(item)
          ? item.join("\n")
          : String(item);
  const [text, setText] = useState(() => display(value));
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState("");
  const label = t(spec.label ?? fieldLabel(spec.name));
  const apply = (input: string) => {
    setText(input);
    try {
      if (!input && spec.type !== "textarea") {
        onChange(undefined);
        setError("");
        return;
      }
      const next: unknown =
        spec.type === "number"
          ? Number(input)
          : spec.type === "json"
            ? JSON.parse(input)
            : spec.type === "lines"
              ? input.split("\n").filter(Boolean)
              : input;
      if (typeof next === "number" && !Number.isFinite(next))
        throw new Error("Expected a finite number");
      onChange(next);
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  };
  let control: ReactNode;
  if (spec.type === "boolean")
    control = (
      <input
        type="checkbox"
        checked={
          typeof value === "boolean" ? value : spec.defaultValue === true
        }
        onChange={(event) => {
          try {
            onChange(event.currentTarget.checked);
            setError("");
          } catch (cause) {
            setError(cause instanceof Error ? cause.message : String(cause));
          }
        }}
      />
    );
  else if (spec.options)
    control = (
      <select
        value={typeof value === "string" ? value : ""}
        onChange={(event) => {
          try {
            onChange(event.currentTarget.value || undefined);
            setError("");
          } catch (cause) {
            setError(cause instanceof Error ? cause.message : String(cause));
          }
        }}
      >
        <option value="">—</option>
        {spec.options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    );
  else {
    const props = {
      value: editing ? text : display(value),
      onFocus: () => {
        setText(display(value));
        setEditing(true);
        onBegin();
      },
      onBlur: () => {
        onEnd();
        setEditing(false);
        if (error) {
          setText(display(value));
          setError("");
        }
      },
      onChange: (
        event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
      ) => apply(event.currentTarget.value),
      "aria-invalid": Boolean(error),
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
          step={spec.type === "number" ? "any" : undefined}
        />
      );
  }
  return (
    <div className={`pne-field ${spec.type === "boolean" ? "pne-check" : ""}`}>
      <label>
        <span>{label}</span>
        {control}
      </label>
      {spec.asset && onPick ? (
        <button type="button" className="pne-subtle" onClick={onPick}>
          {t("Browse assets")}
        </button>
      ) : null}
      {error ? <small role="alert">{error}</small> : null}
    </div>
  );
}

export const commonFields: FieldSpec[] = [
  { name: "label" },
  { name: "visible", type: "boolean", defaultValue: true },
  { name: "interactive", type: "boolean", defaultValue: true },
  { name: "pointerEvents", options: ["auto", "none"] },
  { name: "renderOrder", type: "number" },
  { name: "cursor" },
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
    { name: "text", type: "textarea" },
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
    { name: "referrerPolicy" },
    { name: "loading", options: ["eager", "lazy"] },
    { name: "pointerPolicy", options: ["hotspot", "content"] },
    { name: "background" },
  ],
  polygon: [{ name: "fill" }, ...numbers("fillOpacity"), ...stroke],
  polyline: stroke,
};
