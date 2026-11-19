import { useId, useState } from "react";
import {
  getHotspotCornerCenter,
  moveHotspotCorners,
  rotateHotspotCorners,
  validateHotspotCorners,
  type HotspotCorners,
  type HotspotPosition,
  type ProjectHotspotDefinition,
} from "@ericchen1990/pano-view";
import { cornerLabels, updateCorner } from "./corner-handles";
import { Field } from "./fields";
import { hotspotFieldSpec } from "./hotspot-field-specs";
import { errorMessage } from "./errors";
import type { Translate } from "./i18n";

export function CornerFields({ hotspot, getRectangleCorners, onChange, onBegin, onEnd, t }: {
  hotspot: Extract<ProjectHotspotDefinition, { type: "image" | "video" }>;
  getRectangleCorners: (id: string) => HotspotCorners | null;
  onChange: (hotspot: ProjectHotspotDefinition) => void;
  onBegin: () => void;
  onEnd: () => void;
  t: Translate;
}) {
  const angleId = useId();
  const [angle, setAngle] = useState("");
  const [error, setError] = useState("");
  const { corners } = hotspot;
  const center = corners && getHotspotCornerCenter(corners);
  const apply = (next: HotspotCorners | undefined) => {
    if (next && !validateHotspotCorners(next))
      throw new Error(t("Corners must form a convex, clockwise quadrilateral"));
    onChange({ ...hotspot, corners: next });
    setError("");
  };
  const coordinates = (point: HotspotPosition, update: (point: HotspotPosition) => void) =>
    (["yaw", "pitch"] as const).map((axis) => (
      <Field
        key={axis}
        spec={hotspotFieldSpec({ name: axis, type: "number" })}
        value={point[axis]}
        onBegin={onBegin}
        onEnd={onEnd}
        onChange={(value) => {
          if (typeof value !== "number") throw new Error(t("Coordinate is required"));
          update({ ...point, [axis]: value });
        }}
        t={t}
      />
    ));
  const rotate = () => {
    if (!corners || angle.trim() === "") return;
    apply(rotateHotspotCorners(corners, Number(angle)));
    setAngle("");
  };

  return (
    <div className="pne-fields">
      <button type="button" onClick={() => {
        try {
          if (corners) {
            apply(undefined);
            setAngle("");
          } else {
            const rectangle = getRectangleCorners(hotspot.id);
            if (!rectangle) throw new Error(t("Wait for the hotspot to appear before enabling corner placement"));
            apply(rectangle);
          }
        } catch (cause) {
          setError(errorMessage(cause));
        }
      }}>
        {t(corners ? "Restore rectangle" : "Enable corner placement")}
      </button>
      {error ? <p role="alert">{error}</p> : null}
      {corners && center ? (
        <>
          <fieldset>
            <legend>{t("Hotspot center")}</legend>
            {coordinates(center, (point) => apply(moveHotspotCorners(corners, center, point)))}
          </fieldset>
          {corners.map((corner, index) => (
            <fieldset key={index}>
              <legend>{t(cornerLabels[index]!)}</legend>
              {coordinates(corner, (point) => apply(updateCorner(corners, index, point)))}
            </fieldset>
          ))}
          <div className="pne-field">
            <label htmlFor={angleId}>{t("Rotate by (° clockwise)")}</label>
            <input
              id={angleId}
              type="number"
              step="any"
              value={angle}
              onChange={(event) => setAngle(event.currentTarget.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  rotate();
                }
              }}
            />
            <button type="button" onClick={rotate} disabled={!angle || !Number.isFinite(Number(angle))}>
              {t("Apply rotation")}
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}
