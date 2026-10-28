import { useEffect, useId, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import type {
  PanoProjectDefinition,
  PanoProjectSceneDefinition,
  PanoViewerState,
} from "@ericchen1990/pano-view";
import { Field, setField } from "./fields";
import { moveScene } from "./document";
import type { Translate } from "./i18n";

export function SceneSidebar({
  project,
  activeId,
  selectedId,
  preview,
  busy,
  onTitle,
  onNavigate,
  onSelectHotspot,
  onEditHotspot,
  onDeleteHotspot,
  onAdd,
  onDelete,
  onReorder,
  onBegin,
  onEnd,
  t,
}: {
  project: PanoProjectDefinition;
  activeId?: string;
  selectedId?: string;
  preview: boolean;
  busy: boolean;
  onTitle: (title: string | undefined) => void;
  onNavigate: (id: string) => void;
  onSelectHotspot: (id: string) => void;
  onEditHotspot: (id: string) => void;
  onDeleteHotspot: (id: string) => void;
  onAdd: () => void;
  onDelete: (id: string) => void;
  onReorder: (id: string, beforeId?: string) => void;
  onBegin: () => void;
  onEnd: () => void;
  t: Translate;
}) {
  const [collapsedId, setCollapsedId] = useState<string>();
  const listId = useId();
  const listRef = useRef<HTMLUListElement>(null);
  const dragRef = useRef<{
    id: string;
    beforeId?: string;
    pointerId?: number;
    startY?: number;
    started: boolean;
  }>(undefined);
  const [drag, setDrag] = useState<{ id: string; beforeId?: string }>();
  const [announcement, setAnnouncement] = useState("");
  useEffect(() => {
    if (busy || preview) {
      dragRef.current = undefined;
      setDrag(undefined);
    }
  }, [busy, preview]);
  function finishDrag(commit: boolean) {
    const current = dragRef.current;
    dragRef.current = undefined;
    setDrag(undefined);
    if (!current?.started) return;
    if (commit && !busy && !preview) onReorder(current.id, current.beforeId);
    setAnnouncement(t(commit ? "Reordering finished." : "Reordering cancelled."));
  }
  function pointerMove(event: PointerEvent<HTMLButtonElement>) {
    const current = dragRef.current;
    if (!current || current.pointerId !== event.pointerId) return;
    if (!current.started && Math.abs(event.clientY - current.startY!) < 5) return;
    const headers = Array.from(listRef.current?.querySelectorAll<HTMLElement>(".pne-scene-header") ?? []);
    const beforeId = headers.find((header) => {
      const rect = header.getBoundingClientRect();
      return event.clientY < rect.top + rect.height / 2;
    })?.dataset.sceneId;
    if (!current.started || beforeId !== current.beforeId) {
      current.started = true;
      current.beforeId = beforeId;
      setDrag({ id: current.id, beforeId });
    }
  }
  function reorderKey(event: KeyboardEvent<HTMLButtonElement>, id: string) {
    const current = dragRef.current;
    if (event.key === "Escape" && current) {
      event.preventDefault();
      event.stopPropagation();
      finishDrag(false);
    } else if (event.key === " " || event.key === "Enter") {
      event.preventDefault();
      event.stopPropagation();
      if (current?.id === id) finishDrag(true);
      else {
        const index = project.scenes.findIndex((scene) => scene.id === id);
        const next = { id, beforeId: project.scenes[index + 1]?.id, started: true };
        dragRef.current = next;
        setDrag(next);
        setAnnouncement(t("Scene picked up. Use arrow keys to choose a position, then Space or Enter to drop. Escape cancels."));
      }
    } else if (current?.id === id && current.pointerId === undefined && ["ArrowUp", "ArrowDown"].includes(event.key)) {
      event.preventDefault();
      event.stopPropagation();
      const others = project.scenes.filter((scene) => scene.id !== id);
      const index = current.beforeId === undefined ? others.length : others.findIndex((scene) => scene.id === current.beforeId);
      const target = Math.max(0, Math.min(others.length, index + (event.key === "ArrowUp" ? -1 : 1)));
      current.beforeId = others[target]?.id;
      setDrag({ id, beforeId: current.beforeId });
      const position = moveScene(project, id, current.beforeId).scenes.findIndex((scene) => scene.id === id) + 1;
      setAnnouncement(`${t("Position")} ${position} / ${project.scenes.length}`);
    }
  }
  return (
    <aside className="pne-sidebar" aria-label={t("Scenes")}>
      <div className="pne-panel-title">
        {t("Scenes")}
        <span>{project.scenes.length}</span>
      </div>
      <div className="pne-fields">
        <Field
          spec={{ name: "title", label: "Project title" }}
          value={project.title}
          onBegin={onBegin}
          onEnd={onEnd}
          onChange={(value) =>
            onTitle(typeof value === "string" && value ? value : undefined)
          }
          t={t}
        />
      </div>
      {!preview ? (
        <div className="pne-add-scene">
          <button type="button" onClick={onAdd} disabled={busy}>
            {t("Add scene")}
          </button>
        </div>
      ) : null}
      {!preview ? <>
        <p className="pne-reorder-hint">{t("Drag the handle to reorder scenes.")}</p>
        <p className="pne-sr-only" id={`${listId}-reorder-help`}>{t("Press Space or Enter to pick up a scene, arrow keys to move, and Space or Enter to drop. Escape cancels.")}</p>
        <span className="pne-sr-only" role="status">{announcement}</span>
      </> : null}
      <ul ref={listRef} className="pne-scene-list" data-drop-end={Boolean(drag && drag.beforeId === undefined)}>
        {project.scenes.map((scene, index) => {
          const current = activeId === scene.id;
          const expanded = !preview && current && (collapsedId !== scene.id || Boolean(selectedId));
          const hotspots = scene.hotspots ?? [];
          const title = scene.title ?? scene.id;
          return (
            <li className="pne-scene-group" key={scene.id} data-active={current} data-dragging={drag?.id === scene.id} data-drop-before={Boolean(drag && drag.beforeId === scene.id)}>
              <div className="pne-scene-header" data-scene-id={scene.id}>
                {!preview ? (
                  <button
                    type="button"
                    className="pne-scene-drag"
                    disabled={busy || project.scenes.length < 2}
                    aria-label={`${t("Reorder scene")}: ${title}`}
                    aria-describedby={`${listId}-reorder-help`}
                    aria-pressed={drag?.id === scene.id}
                    title={t("Drag the handle to reorder scenes.")}
                    onPointerDown={(event) => {
                      if (event.button !== 0) return;
                      event.preventDefault();
                      event.currentTarget.focus({ preventScroll: true });
                      event.currentTarget.setPointerCapture(event.pointerId);
                      dragRef.current = { id: scene.id, pointerId: event.pointerId, startY: event.clientY, started: false };
                    }}
                    onPointerMove={pointerMove}
                    onPointerUp={(event) => {
                      finishDrag(true);
                      if (event.currentTarget.hasPointerCapture(event.pointerId))
                        event.currentTarget.releasePointerCapture(event.pointerId);
                    }}
                    onPointerCancel={() => finishDrag(false)}
                    onLostPointerCapture={() => finishDrag(false)}
                    onKeyDown={(event) => reorderKey(event, scene.id)}
                  >
                    <svg width="14" height="16" viewBox="0 0 14 16" fill="currentColor" aria-hidden="true">
                      {[4, 8, 12].map((y) => <g key={y}><circle cx="4" cy={y} r="1" /><circle cx="10" cy={y} r="1" /></g>)}
                    </svg>
                  </button>
                ) : null}
              <button
                type="button"
                className="pne-scene"
                aria-pressed={current}
                aria-expanded={preview ? undefined : expanded}
                aria-controls={expanded ? `${listId}-${index}` : undefined}
                title={title}
                onClick={() => {
                  setCollapsedId(expanded && !selectedId ? scene.id : undefined);
                  onNavigate(scene.id);
                }}
              >
                {!preview ? (
                  <svg className="pne-scene-chevron" data-expanded={expanded} width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                    <path d="m6 3 5 5-5 5" />
                  </svg>
                ) : null}
                <b>{title}</b>
                <span className="pne-scene-count" aria-label={`${hotspots.length} ${t("Hotspots")}`}>{hotspots.length}</span>
                {project.initialSceneId === scene.id ? <small title={t("Initial scene")}>★</small> : null}
              </button>
                {!preview ? (
                  <button type="button" className="pne-scene-delete" disabled={busy} title={t("Delete scene")} aria-label={`${t("Delete scene")}: ${title}`} onClick={() => onDelete(scene.id)}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7" />
                    </svg>
                  </button>
                ) : null}
              </div>
              {expanded ? (
                <div className="pne-scene-children" id={`${listId}-${index}`}>
                  <div className="pne-hotspot-heading">
                    {t("Hotspots")} <span>{hotspots.length}</span>
                  </div>
                  {hotspots.length ? (
                    <ul className="pne-hotspot-list" aria-label={`${t("Hotspots")} · ${title}`}>
                      {hotspots.map((hotspot) => {
                        const name = hotspot.label || hotspot.id;
                        return (
                          <li className="pne-hotspot-item" key={hotspot.id} data-selected={selectedId === hotspot.id}>
                            <button
                              type="button"
                              className="pne-hotspot-row"
                              title={name}
                              aria-label={`${t("Select hotspot")}: ${name}`}
                              aria-pressed={selectedId === hotspot.id}
                              onClick={() => onSelectHotspot(hotspot.id)}
                            >
                              <b>{name}</b>
                              <small>{t(hotspot.type)}</small>
                            </button>
                            <div className="pne-hotspot-actions">
                              <button
                                type="button"
                                disabled={busy}
                                title={t("Edit hotspot")}
                                aria-label={`${t("Edit hotspot")}: ${name}`}
                                onClick={() => onEditHotspot(hotspot.id)}
                              >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                  <path d="m16 3 5 5-12 12-6 1 1-6Z" />
                                  <path d="m13 6 5 5" />
                                </svg>
                              </button>
                              <button
                                type="button"
                                disabled={busy}
                                title={t("Delete hotspot")}
                                aria-label={`${t("Delete hotspot")}: ${name}`}
                                onClick={() => onDeleteHotspot(hotspot.id)}
                              >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                  <path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7" />
                                </svg>
                              </button>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <p className="pne-hotspot-empty">{t("No hotspots yet. Use Add hotspot to place the first one.")}</p>
                  )}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </aside>
  );
}

export function SceneSettings({
  scene,
  initialSceneId,
  onChange,
  onSetInitial,
  getView,
  onReplace,
  onImport,
  busy,
  onBegin,
  onEnd,
  t,
}: {
  scene: PanoProjectSceneDefinition;
  initialSceneId?: string;
  onChange: (scene: PanoProjectSceneDefinition) => void;
  onSetInitial: () => void;
  getView: () => PanoViewerState | undefined;
  onReplace: () => void;
  onImport?: () => void;
  busy: boolean;
  onBegin: () => void;
  onEnd: () => void;
  t: Translate;
}) {
  return (
    <div className="pne-fields">
      <Field
        spec={{ name: "title", label: "Scene title" }}
        value={scene.title}
        onBegin={onBegin}
        onEnd={onEnd}
        onChange={(value) =>
          onChange({
            ...scene,
            title: typeof value === "string" && value ? value : undefined,
          })
        }
        t={t}
      />
      <label className="pne-check">
        <input
          type="radio"
          checked={initialSceneId === scene.id}
          onChange={onSetInitial}
        />
        {t("Initial scene")}
      </label>
      <fieldset>
        <legend>{t("Initial view")}</legend>
        <button
          type="button"
          onClick={() => {
            const view = getView();
            if (view) onChange({ ...scene, initialView: view });
          }}
        >
          {t("Set current view")}
        </button>
        {(["yaw", "pitch", "fov"] as const).map((axis) => (
          <Field
            key={axis}
            spec={{ name: axis, type: "number", defaultValue: axis === "fov" ? 75 : 0,
              number: axis === "pitch" ? { min: -90, max: 90 } : axis === "fov" ? { min: 1, max: 179 } : undefined }}
            value={scene.initialView?.[axis]}
            onBegin={onBegin}
            onEnd={onEnd}
            onChange={(value) =>
              onChange(setField(scene, `initialView.${axis}`, value))
            }
            t={t}
          />
        ))}
      </fieldset>
      <fieldset>
        <legend>{t("View limits")}</legend>
        <p className="pne-field-help">{t("Limits apply to the center of the view in both editing and preview.")}</p>
        {(["yaw", "pitch", "fov"] as const).map((axis) => {
          const range = scene.viewLimits?.[axis];
          const defaults = axis === "yaw" ? { min: -180, max: 180 }
            : axis === "pitch" ? { min: -90, max: 90 } : { min: 30, max: 100 };
          const label = axis === "yaw" ? "Yaw" : axis === "pitch" ? "Pitch" : "Fov";
          return <fieldset key={axis}>
            <legend>{t(label)}</legend>
            <label className="pne-check">
              <input type="checkbox" checked={Boolean(range)}
                aria-label={`${t(label)} · ${t("Enable limits")}`}
                onChange={(event) => {
                  const viewLimits = { ...scene.viewLimits };
                  if (event.currentTarget.checked) viewLimits[axis] = defaults;
                  else delete viewLimits[axis];
                  onChange({ ...scene, viewLimits: Object.keys(viewLimits).length ? viewLimits : undefined });
                }} />
              {t("Enable limits")}
            </label>
            {range ? <div className="pne-button-grid">
              {(["min", "max"] as const).map((bound) => <Field
                key={bound}
                spec={{ name: `${axis}-${bound}`, label: bound === "min" ? "Minimum" : "Maximum", type: "number",
                  number: { min: axis === "yaw" ? -180 : axis === "pitch" ? -90 : 1,
                    max: axis === "yaw" ? 180 : axis === "pitch" ? 90 : 179, required: true } }}
                value={range[bound]}
                onBegin={onBegin} onEnd={onEnd} t={t}
                onChange={(value) => {
                  if (typeof value !== "number") return;
                  const next = { ...range, [bound]: value };
                  if (axis !== "yaw" && next.min > next.max)
                    throw new Error("Minimum must not exceed maximum.");
                  onChange({ ...scene, viewLimits: { ...scene.viewLimits, [axis]: next } });
                }} />)}
            </div> : null}
          </fieldset>;
        })}
        <p className="pne-field-help">{t("Yaw minimum greater than maximum crosses ±180° (for example, 170 to -170). Equal values lock an axis.")}</p>
      </fieldset>
      <button type="button" disabled={busy} onClick={onReplace}>
        {t("Replace source")}
      </button>
      {onImport ? (
        <button type="button" disabled={busy} onClick={onImport}>
          {t("Import image")}
        </button>
      ) : null}
      <p className="pne-hint">{t("Select a hotspot to edit its properties")}</p>
    </div>
  );
}
