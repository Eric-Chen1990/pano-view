import { hotspotAction, setHotspotAction, projectHotspotTriggers, type ProjectHotspotTrigger } from "@ericchen1990/pano-view/data";
import { customActionDefaults, customActionIssue, type PanoCustomActionDefinition } from "./custom-actions";
import {
  normalizePanoYaw,
  type PanoProjectSceneDefinition,
  type PanoViewerState,
  type PanoViewLimits,
  type ProjectHotspotDefinition,
  type ProjectPopupDefinition,
} from "@ericchen1990/pano-view";
import { Field } from "./fields";
import { sceneStartingView } from "./document";
import type { Translate } from "./i18n";

const viewSliderKeys = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End", "PageUp", "PageDown"];

function ViewFields({ view, sliderLimits, onChange, onBegin, onEnd, t }: {
  view: PanoViewerState;
  sliderLimits?: PanoViewLimits;
  onChange: (view: PanoViewerState) => void;
  onBegin: () => void;
  onEnd: () => void;
  t: Translate;
}) {
  return (["yaw", "pitch", "fov"] as const).map((axis) => {
    const label = axis === "yaw" ? "Horizontal angle (°)" : axis === "pitch" ? "Vertical angle (°)" : "Field of view (°)";
    const update = (value: unknown) => {
      if (typeof value === "number") onChange({ ...view, [axis]: value });
    };
    const numberField = <Field key={axis}
      spec={{
        name: axis,
        label,
        type: "number",
        number: { required: true, ...(axis === "pitch" ? { min: -90, max: 90 } : axis === "fov" ? { exclusiveMin: 0, max: 179.99 } : {}) },
      }}
      value={view[axis]}
      onChange={update}
      onBegin={onBegin} onEnd={onEnd} t={t}
    />;
    if (!sliderLimits) return numberField;

    const limits = sliderLimits[axis] ?? (axis === "fov" ? { min: 30, max: 100 }
      : axis === "pitch" ? { min: -90, max: 90 } : { min: -180, max: 180 });
    const min = limits.min;
    const max = axis === "yaw" && limits.max < min ? limits.max + 360 : limits.max;
    const value = sliderValue(axis, view[axis], min, max);
    return <div key={axis} className="pne-arrival-angle">
      {numberField}
      <input type="range" aria-label={t(label)} min={min} max={max} step="any"
        value={value} disabled={min === max}
        aria-valuetext={`${axis === "yaw" && value > 180 ? value - 360 : value}°`}
        onPointerDown={(event) => {
          if (!event.isPrimary || event.button !== 0) return;
          event.currentTarget.focus({ preventScroll: true });
          event.currentTarget.setPointerCapture(event.pointerId);
          onBegin();
        }}
        onPointerUp={onEnd} onPointerCancel={onEnd} onLostPointerCapture={onEnd}
        onKeyDown={(event) => { if (viewSliderKeys.includes(event.key)) onBegin(); }}
        onKeyUp={(event) => { if (viewSliderKeys.includes(event.key)) onEnd(); }}
        onBlur={onEnd}
        onChange={(event) => {
          const next = Math.max(min, Math.min(max, Number(event.currentTarget.valueAsNumber.toFixed(1))));
          update(axis === "yaw" && next > 180 ? next - 360 : next);
        }} />
    </div>;
  });
}

function sliderValue(axis: keyof PanoViewerState, value: number, min: number, max: number): number {
  if (value >= min && value <= max) return value;
  if (axis !== "yaw") return Math.max(min, Math.min(max, value));
  const offset = ((value - min) % 360 + 360) % 360;
  if (offset <= max - min) return min + offset;
  const distanceToMin = Math.abs(normalizePanoYaw(value - min));
  const distanceToMax = Math.abs(normalizePanoYaw(value - max));
  return distanceToMin <= distanceToMax ? min : max;
}

function EventActionEditor({
  hotspot, scenes, popups, getView, onChange, onBegin, onEnd,
  onCreatePopup, onEditPopup, onTest, t, trigger, customActions = [],
}: {
  hotspot: ProjectHotspotDefinition;
  scenes: PanoProjectSceneDefinition[];
  popups: ProjectPopupDefinition[];
  getView: () => PanoViewerState;
  onChange: (hotspot: ProjectHotspotDefinition) => void;
  onBegin: () => void;
  onEnd: () => void;
  trigger: ProjectHotspotTrigger;
  customActions?: readonly PanoCustomActionDefinition[];
  onCreatePopup?: (trigger: ProjectHotspotTrigger) => void;
  onEditPopup?: (id: string) => void;
  onTest?: (trigger: ProjectHotspotTrigger) => void;
  t: Translate;
}) {
  const action = hotspotAction(hotspot, trigger);
  const update: typeof onChange = next => onChange(setHotspotAction(hotspot, trigger, next.action));
  const definition = action?.type === "custom" ? customActions.find(item => item.id === action.actionId) : undefined;
  const issue = action?.type === "custom" ? customActionIssue(action, customActions) : undefined;
  const canTest = hotspot.visible !== false && hotspot.interactive !== false && hotspot.pointerEvents !== "none";
  const changeView = (patch: Partial<PanoViewerState>) => {
    if (action?.type === "view")
      update({ ...hotspot, action: { ...action, view: { ...action.view, ...patch } } });
  };
  return (
    <details open>
      <summary>{t(trigger === "click" ? "Click" : trigger === "pointerenter" ? "Pointer enter" : "Pointer leave")}</summary>
      <div className="pne-fields">
        <label>
          {t("Action type")}
          <select value={action?.type ?? ""} onChange={(event) => {
            switch (event.currentTarget.value) {
              case "scene":
                if (scenes[0]) update({ ...hotspot, action: { type: "scene", sceneId: scenes[0].id } });
                break;
              case "view":
                update({ ...hotspot, action: { type: "view", view: getView() } });
                break;
              case "popup":
                if (popups[0]) update({ ...hotspot, action: { type: "popup", popupId: popups[0].id } });
                else onCreatePopup?.(trigger);
                break;
              case "custom":
                if (customActions[0]) update({ ...hotspot, action: { type: "custom", actionId: customActions[0].id, params: customActionDefaults(customActions[0]) } });
                break;
              default:
                update({ ...hotspot, action: undefined });
            }
          }}>
            <option value="">{t(trigger === "click" && ["audio", "video", "sequence"].includes(hotspot.type) ? "Default: toggle playback" : "No action")}</option>
            <option value="scene" disabled={!scenes.length}>{t("Switch scene")}</option>
            <option value="view">{t("Adjust view")}</option>
            <option value="popup">{t("Open popup")}</option>
            <option value="custom" disabled={!customActions.length && action?.type !== "custom"}>{t("Custom action")}</option>
          </select>
        </label>
        {action?.type === "scene" ? (
          <label>
            {t("Target scene")}
            <select value={action.sceneId} onChange={(event) => update({ ...hotspot, action: { type: "scene", sceneId: event.currentTarget.value } })}>
              {scenes.map((scene) => <option key={scene.id} value={scene.id}>{scene.title ?? scene.id}</option>)}
            </select>
          </label>
        ) : null}
        {action?.type === "view" ? (
          <>
            <ViewFields view={action.view} onChange={changeView} onBegin={onBegin} onEnd={onEnd} t={t} />
            <Field
              spec={{ name: "duration", label: "Animation duration (ms)", type: "number", defaultValue: 700, number: { min: 0 } }}
              value={action.duration}
              onChange={(duration) => {
                if (duration === undefined || typeof duration === "number")
                  update({ ...hotspot, action: { ...action, duration } });
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
              <select value={action.popupId} onChange={(event) => update({ ...hotspot, action: { type: "popup", popupId: event.currentTarget.value } })}>
                {popups.map((popup) => <option key={popup.id} value={popup.id}>{popup.title || popup.id}</option>)}
              </select>
            </label>
            <button type="button" onClick={() => onEditPopup?.(action.popupId)}>{t("Edit shared popup")}</button>
            <button type="button" onClick={() => onCreatePopup?.(trigger)}>{t("New shared popup")}</button>
          </>
        ) : null}
        {action?.type === "custom" ? <>
          <label>{t("Custom action")}<select value={action.actionId} onChange={event => {
            const next = customActions.find(item => item.id === event.currentTarget.value);
            if (next) update({ ...hotspot, action: { type: "custom", actionId: next.id, params: customActionDefaults(next) } });
          }}>
            {!definition ? <option value={action.actionId}>{action.actionId}</option> : null}
            {customActions.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select></label>
          {definition?.description ? <p>{definition.description}</p> : null}
          {!definition ? <><p role="status">{t("Action is not registered in this environment")}</p><pre>{JSON.stringify(action.params ?? {}, null, 2)}</pre></> : definition.fields.map(field => <Field key={`${action.actionId}:${field.name}`}
            spec={{ name: field.name, label: field.label, type: field.type === "string" || field.type === "select" ? undefined : field.type, options: field.type === "select" ? field.options : undefined, number: field.type === "number" ? { min: field.min, max: field.max, required: field.required } : undefined }}
            value={action.params?.[field.name]} onBegin={onBegin} onEnd={onEnd} t={t}
            onChange={value => {
              const params = { ...action.params };
              if (value === undefined) delete params[field.name];
              else params[field.name] = value as string | number | boolean;
              update({ ...hotspot, action: { ...action, params } });
            }} />)}
          {issue ? <p role="alert">{issue.replace(/Required$/, t("Required")).replace(/Invalid value$/, t("Invalid value"))}</p> : null}
        </> : null}
        {onTest ? <button type="button" disabled={!canTest || Boolean(issue)} onClick={() => onTest?.(trigger)}>{t("Test this event")}</button> : null}
        {!canTest ? <p className="pne-field-help">{t("Show the hotspot and enable pointer interaction to test a click.")}</p> : null}
      </div>
    </details>
  );
}

export function HotspotActionEditor(props: Omit<Parameters<typeof EventActionEditor>[0], "trigger"> & {
  onArrivalPreviewMount?: (node: HTMLDivElement | null) => void;
}) {
  if (props.hotspot.type === "portal") {
    const { hotspot, scenes, onBegin, onEnd, onChange, onTest, t } = props;
    const action = hotspotAction(hotspot, "click");
    const target = action?.type === "scene" ? action.sceneId : "";
    const targetScene = scenes.find((scene) => scene.id === target);
    const hasTarget = targetScene !== undefined;
    const arrivalView = hotspot.arrivalView;
    return <div className="pne-fields">
        <label>{t("Target scene")}
          <select value={hasTarget ? target : ""} onChange={({ currentTarget }) => {
            onChange(setHotspotAction(hotspot, "click", currentTarget.value
              ? { type: "scene", sceneId: currentTarget.value } : undefined));
          }}>
            <option value="">{t("Select a target scene")}</option>
            {scenes.map((scene) => <option key={scene.id} value={scene.id}>{scene.title ?? scene.id}</option>)}
          </select>
        </label>
        {!hasTarget ? <p className="pne-field-help">{t(scenes.length
          ? "Choose a new target scene to reconnect this portal."
          : "Add another scene before connecting this portal.")}</p> : null}
        <label>
          {t("Arrival view")}
          <select value={arrivalView ? "custom" : "initial"} onChange={(event) => onChange({
            ...hotspot,
            arrivalView: event.currentTarget.value === "custom" ? sceneStartingView(targetScene) : undefined,
          })}>
            <option value="initial">{t("Use destination scene's initial view")}</option>
            <option value="custom">{t("Custom arrival view")}</option>
          </select>
        </label>
        {arrivalView ? (
          <>
            {hasTarget && props.onArrivalPreviewMount ? (
              <div role="region" aria-label={t("Arrival view preview")}>
                <p className="pne-arrival-preview-label">{t("Arrival view preview")}</p>
                <div className="pne-portal-arrival-preview" ref={props.onArrivalPreviewMount} />
              </div>
            ) : null}
            <ViewFields view={arrivalView} sliderLimits={targetScene?.viewLimits ?? {}}
              onChange={(view) => onChange({ ...hotspot, arrivalView: view })}
              onBegin={onBegin} onEnd={onEnd} t={t} />
          </>
        ) : null}
        {onTest ? <button type="button" disabled={!hasTarget || hotspot.visible === false || hotspot.interactive === false || hotspot.pointerEvents === "none"}
          onClick={() => onTest("click")}>{t("Test portal entry")}</button> : null}
      </div>;
  }
  return <section aria-label={props.t("Interaction events")}><h3>{props.t("Interaction events")}</h3>{projectHotspotTriggers.map(trigger => <EventActionEditor key={trigger} {...props} trigger={trigger} />)}</section>;
}
