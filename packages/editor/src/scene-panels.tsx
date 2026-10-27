import type {
  PanoProjectDefinition,
  PanoProjectSceneDefinition,
  PanoViewerState,
} from "@ericchen1990/pano-view";
import { Field, setField } from "./fields";
import type { Translate } from "./i18n";

export function SceneSidebar({
  project,
  activeId,
  selectedId,
  preview,
  busy,
  canAdd,
  onTitle,
  onNavigate,
  onSelectHotspot,
  onAdd,
  onDuplicate,
  onDelete,
  onMove,
  onBegin,
  onEnd,
  t,
}: {
  project: PanoProjectDefinition;
  activeId?: string;
  selectedId?: string;
  preview: boolean;
  busy: boolean;
  canAdd: boolean;
  onTitle: (title: string | undefined) => void;
  onNavigate: (id: string) => void;
  onSelectHotspot: (id: string) => void;
  onAdd: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onMove: (offset: -1 | 1) => void;
  onBegin: () => void;
  onEnd: () => void;
  t: Translate;
}) {
  const active = project.scenes.find((scene) => scene.id === activeId);
  const index = project.scenes.findIndex((scene) => scene.id === activeId);
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
      <div className="pne-scene-list">
        {project.scenes.map((scene, index) => (
          <button
            type="button"
            className="pne-scene"
            key={scene.id}
            aria-pressed={activeId === scene.id}
            onClick={() => onNavigate(scene.id)}
          >
            <span>{String(index + 1).padStart(2, "0")}</span>
            <b>{scene.title ?? scene.id}</b>
            {project.initialSceneId === scene.id ? <small>★</small> : null}
          </button>
        ))}
      </div>
      {!preview ? (
        <div className="pne-fields">
          <button type="button" onClick={onAdd} disabled={busy || !canAdd}>
            {t("Add scene")}
          </button>
          {active ? (
            <div className="pne-button-grid">
              <button type="button" onClick={onDuplicate}>
                {t("Duplicate")}
              </button>
              <button type="button" disabled={busy} onClick={onDelete}>
                {t("Delete")}
              </button>
              {([-1, 1] as const).map((offset) => (
                <button
                  type="button"
                  key={offset}
                  disabled={
                    index + offset < 0 ||
                    index + offset >= project.scenes.length
                  }
                  onClick={() => onMove(offset)}
                >
                  {t(offset < 0 ? "Move up" : "Move down")}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
      {active ? (
        <>
          <div className="pne-panel-title">
            {t("Hotspots")}
            <span>{active.hotspots?.length ?? 0}</span>
          </div>
          {active.hotspots?.map((hotspot) => (
            <button
              type="button"
              className="pne-hotspot-row"
              key={hotspot.id}
              aria-pressed={selectedId === hotspot.id}
              onClick={() => onSelectHotspot(hotspot.id)}
            >
              {t(hotspot.type)}
              <b>{hotspot.label || hotspot.id}</b>
            </button>
          ))}
        </>
      ) : null}
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
          spec={{ name: axis, type: "number" }}
          value={scene.initialView?.[axis]}
          onBegin={onBegin}
          onEnd={onEnd}
          onChange={(value) =>
            onChange(setField(scene, `initialView.${axis}`, value))
          }
          t={t}
        />
      ))}
      <p className="pne-source-path">
        {scene.source.viewerUrl ?? t("Scene source")}
      </p>
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
