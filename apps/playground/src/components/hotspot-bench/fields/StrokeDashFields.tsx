import {
  checkboxLabelClassName,
  fieldClassName,
  fieldGridClassName,
  fieldInputClassName,
  fieldLabelClassName,
} from "../../../ui";
import { numberValue } from "../../../utils";

const DEFAULT_DASH_SIZE = 8;
const DEFAULT_GAP_SIZE = 4;

export function StrokeDashFields({
  strokeDashSize,
  strokeGapSize,
  onChange,
}: {
  strokeDashSize: number;
  strokeGapSize: number;
  onChange: (patch: { strokeDashSize: number; strokeGapSize: number }) => void;
}) {
  const dashed = strokeDashSize > 0;

  return (
    <>
      <label className={`${checkboxLabelClassName} col-span-full`}>
        <input
          className="accent-[#df6b42]"
          checked={dashed}
          onChange={(event) =>
            onChange(
              event.currentTarget.checked
                ? {
                    strokeDashSize: strokeDashSize > 0 ? strokeDashSize : DEFAULT_DASH_SIZE,
                    strokeGapSize: strokeGapSize > 0 ? strokeGapSize : DEFAULT_GAP_SIZE,
                  }
                : { strokeDashSize: 0, strokeGapSize: 0 },
            )
          }
          type="checkbox"
        />
        <span>Dashed stroke</span>
      </label>
      {dashed ? (
        <div className={`${fieldGridClassName} col-span-full`}>
          <label className={fieldClassName}>
            <span className={fieldLabelClassName}>Dash (px)</span>
            <input
              className={fieldInputClassName}
              min="0.5"
              onChange={(event) =>
                onChange({
                  strokeDashSize: Math.max(
                    0.5,
                    numberValue(event.currentTarget.value, strokeDashSize),
                  ),
                  strokeGapSize,
                })
              }
              step="0.5"
              type="number"
              value={strokeDashSize}
            />
          </label>
          <label className={fieldClassName}>
            <span className={fieldLabelClassName}>Gap (px)</span>
            <input
              className={fieldInputClassName}
              min="0"
              onChange={(event) =>
                onChange({
                  strokeDashSize,
                  strokeGapSize: Math.max(
                    0,
                    numberValue(event.currentTarget.value, strokeGapSize),
                  ),
                })
              }
              step="0.5"
              type="number"
              value={strokeGapSize}
            />
          </label>
        </div>
      ) : null}
    </>
  );
}
