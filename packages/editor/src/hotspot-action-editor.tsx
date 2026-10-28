import type {
  PanoProjectSceneDefinition,
  PanoViewerState,
  ProjectHotspotDefinition,
  ProjectPopupDefinition,
} from "@ericchen1990/pano-view";
import { Field } from "./fields";
import type { Translate } from "./i18n";

export function HotspotActionEditor({
  hotspot, scenes, popups, getView, onChange, onBegin, onEnd,
  onCreatePopup, onEditPopup, onTest, t,
}: {
  hotspot: ProjectHotspotDefinition;
  scenes: PanoProjectSceneDefinition[];
  popups: ProjectPopupDefinition[];
  getView: () => PanoViewerState;
  onChange: (hotspot: ProjectHotspotDefinition) => void;
  onBegin: () => void;
  onEnd: () => void;
  onCreatePopup?: () => void;
  onEditPopup?: (id: string) => void;
  onTest?: () => void;
  t: Translate;
}) {
  const action = hotspot.action;
  const canTest = hotspot.visible !== false && hotspot.interactive !== false && hotspot.pointerEvents !== "none";
  const changeView = (patch: Partial<PanoViewerState>) => {
    if (action?.type === "view")
      onChange({ ...hotspot, action: { ...action, view: { ...action.view, ...patch } } });
  };
  return (
    <details open>
      <summary>{t("Click action")}</summary>
      <div className="pne-fields">
        <label>
          {t("Action type")}
          <select value={action?.type ?? ""} onChange={(event) => {
            switch (event.currentTarget.value) {
              case "scene":
                if (scenes[0]) onChange({ ...hotspot, action: { type: "scene", sceneId: scenes[0].id } });
                break;
              case "view":
                onChange({ ...hotspot, action: { type: "view", view: getView() } });
                break;
              case "popup":
                if (popups[0]) onChange({ ...hotspot, action: { type: "popup", popupId: popups[0].id } });
                else onCreatePopup?.();
                break;
              default:
                onChange({ ...hotspot, action: undefined });
            }
          }}>
            <option value="">{t(["audio", "video", "sequence"].includes(hotspot.type) ? "Default: toggle playback" : "No action")}</option>
            <option value="scene" disabled={!scenes.length}>{t("Switch scene")}</option>
            <option value="view">{t("Adjust view")}</option>
            <option value="popup">{t("Open popup")}</option>
          </select>
        </label>
        {action?.type === "scene" ? (
          <label>
            {t("Target scene")}
            <select value={action.sceneId} onChange={(event) => onChange({ ...hotspot, action: { type: "scene", sceneId: event.currentTarget.value } })}>
              {scenes.map((scene) => <option key={scene.id} value={scene.id}>{scene.title ?? scene.id}</option>)}
            </select>
          </label>
        ) : null}
        {action?.type === "view" ? (
          <>
            {(["yaw", "pitch", "fov"] as const).map((axis) => (
              <Field key={axis}
                spec={{
                  name: axis,
                  label: axis === "yaw" ? "Horizontal angle (°)" : axis === "pitch" ? "Vertical angle (°)" : "Field of view (°)",
                  type: "number",
                  number: { required: true, ...(axis === "pitch" ? { min: -90, max: 90 } : axis === "fov" ? { exclusiveMin: 0, max: 179.99 } : {}) },
                }}
                value={action.view[axis]}
                onChange={(value) => { if (typeof value === "number") changeView({ [axis]: value }); }}
                onBegin={onBegin} onEnd={onEnd} t={t}
              />
            ))}
            <Field
              spec={{ name: "duration", label: "Animation duration (ms)", type: "number", defaultValue: 700, number: { min: 0 } }}
              value={action.duration}
              onChange={(duration) => {
                if (duration === undefined || typeof duration === "number")
                  onChange({ ...hotspot, action: { ...action, duration } });
              }}
              onBegin={onBegin} onEnd={onEnd} t={t}
            />
            <button type="button" onClick={() => changeView(getView())}>{t("Capture current view")}</button>
          </>
        ) : null}
        {action?.type === "popup" ? (
          <>
            <label>
              {t("Shared popup")}
              <select value={action.popupId} onChange={(event) => onChange({ ...hotspot, action: { type: "popup", popupId: event.currentTarget.value } })}>
                {popups.map((popup) => <option key={popup.id} value={popup.id}>{popup.title || popup.id}</option>)}
              </select>
            </label>
            <button type="button" onClick={() => onEditPopup?.(action.popupId)}>{t("Edit shared popup")}</button>
            <button type="button" onClick={onCreatePopup}>{t("New shared popup")}</button>
          </>
        ) : null}
        {onTest ? <button type="button" disabled={!canTest} onClick={onTest}>{t("Test this hotspot")}</button> : null}
        {!canTest ? <p className="pne-field-help">{t("Show the hotspot and enable pointer interaction to test a click.")}</p> : null}
      </div>
    </details>
  );
}
