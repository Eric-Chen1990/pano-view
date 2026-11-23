import type { PanoMapLength } from "@ericchen1990/pano-view";
import type { Translate } from "./i18n";

export function parseSizeUnit(value: PanoMapLength | undefined): {
  amount: number;
  unit: "px" | "%";
} {
  if (typeof value === "string") {
    const match = /^(\d+(?:\.\d+)?)%$/.exec(value.trim());
    if (match) return { amount: Number(match[1]), unit: "%" };
  }
  if (typeof value === "number" && Number.isFinite(value))
    return { amount: value, unit: "px" };
  return { amount: 240, unit: "px" };
}

export function toMapLength(amount: number, unit: "px" | "%"): PanoMapLength {
  if (unit === "%") return `${Math.min(100, Math.max(0.1, amount))}%`;
  return Math.max(1, amount);
}

export function SizeField({
  label,
  value,
  fallbackPx,
  onChange,
  t,
}: {
  label: string;
  value: PanoMapLength | undefined;
  fallbackPx: number;
  onChange: (next: PanoMapLength) => void;
  t: Translate;
}) {
  const parsed = parseSizeUnit(value ?? fallbackPx);
  const amount = value === undefined ? fallbackPx : parsed.amount;
  const unit = value === undefined ? "px" : parsed.unit;
  return (
    <label className="pne-size-field">
      <span>{label}</span>
      <div className="pne-size-field-controls">
        <input
          type="number"
          min={unit === "%" ? 0.1 : 1}
          max={unit === "%" ? 100 : undefined}
          step={unit === "%" ? 0.1 : 1}
          value={amount}
          onChange={(event) =>
            onChange(toMapLength(Number(event.target.value) || 0, unit))
          }
        />
        <select
          aria-label={`${label} ${t("Unit")}`}
          value={unit}
          onChange={(event) => {
            const next = event.target.value as "px" | "%";
            onChange(
              toMapLength(next === "%" ? 40 : fallbackPx, next),
            );
          }}
        >
          <option value="px">px</option>
          <option value="%">%</option>
        </select>
      </div>
    </label>
  );
}
