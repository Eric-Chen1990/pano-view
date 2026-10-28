import type { PanoProjectDefinition, ProjectPopupBlock, ProjectPopupDefinition } from "@ericchen1990/pano-view/data";
import { Field } from "./fields";
import { newId, popupReferences } from "./document";
import type { Translate } from "./i18n";

export function PopupLibrary({ project, selectedId, onSelect, onAdd, onDelete, t }: {
  project: PanoProjectDefinition; selectedId?: string;
  onSelect: (id: string) => void; onAdd: () => void; onDelete: (id: string) => void; t: Translate;
}) {
  return <div className="pne-popup-library">
    <button type="button" className="pne-primary" onClick={onAdd}>{t("New shared popup")}</button>
    <p className="pne-field-help">{t("Edit once to update every hotspot that uses this popup.")}</p>
    {(project.popups ?? []).map((popup) => {
      const references = popupReferences(project, popup.id).length;
      const title = popup.title || t("Untitled popup");
      return <div key={popup.id} className="pne-popup-row">
        <button type="button" className="pne-popup-select" aria-pressed={selectedId === popup.id} onClick={() => onSelect(popup.id)}>
          <span>{title}</span>
          <small>{t("References")}: {references}</small>
        </button>
        <button type="button" className="pne-scene-delete"
          aria-label={`${t("Delete popup")}: ${title}`}
          title={t("Delete popup")}
          onClick={() => onDelete(popup.id)}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7" />
          </svg>
        </button>
      </div>;
    })}
  </div>;
}

export function PopupInspector({ popup, project, onChange, onBegin, onEnd, onPick, onDuplicate, onDelete, onReference, t }: {
  popup: ProjectPopupDefinition; project: PanoProjectDefinition;
  onChange: (popup: ProjectPopupDefinition) => void;
  onBegin: () => void; onEnd: () => void;
  onPick: (blockId: string, field: "src" | "poster") => void;
  onDuplicate: () => void; onDelete: () => void;
  onReference: (sceneId: string, hotspotId: string) => void;
  t: Translate;
}) {
  const refs = popupReferences(project, popup.id);
  const update = (blockId: string, field: string, value: unknown) => onChange({ ...popup,
    blocks: popup.blocks.map((block) => block.id === blockId ? { ...block, [field]: value ?? "" } : block),
  });
  const move = (index: number, offset: number) => {
    onEnd();
    const blocks = [...popup.blocks];
    [blocks[index], blocks[index + offset]] = [blocks[index + offset]!, blocks[index]!];
    onChange({ ...popup, blocks });
  };
  return <div className="pne-inspector-fields">
    <div className="pne-fields">
      <Field spec={{ name: "title", label: "Popup title" }} value={popup.title} onChange={(title) => onChange({ ...popup, title: String(title ?? "") })} onBegin={onBegin} onEnd={onEnd} t={t} />
      <p className="pne-field-help">{t("Shared content is saved in project.json. Media files are included when exporting a project package.")}</p>
      <div className="pne-button-grid">
        <button type="button" onClick={onDuplicate}>{t("Duplicate popup")}</button>
        <button type="button" onClick={onDelete}>{t("Delete popup")}</button>
      </div>
      {refs.length ? <div className="pne-popup-references">
        <p>{t("Deleting this popup also removes its hotspot actions. You can undo the deletion.")}</p>
        {refs.map((ref) => <button type="button" key={`${ref.sceneId}:${ref.hotspotId}:${ref.trigger}`} onClick={() => onReference(ref.sceneId, ref.hotspotId)}>{ref.label}</button>)}
      </div> : null}
    </div>
    {popup.blocks.map((block, index) => <fieldset key={block.id} className="pne-popup-block">
      <legend>{index + 1}. {t(block.type)}</legend>
      <div className="pne-fields">
        {block.type === "text" ? <Field spec={{ name: "text", label: "Text", type: "textarea" }} value={block.text} onChange={(value) => update(block.id, "text", value)} onBegin={onBegin} onEnd={onEnd} t={t} /> : <>
          <Field spec={{ name: "src", label: "Resource path", asset: true }} value={block.src} onChange={(value) => update(block.id, "src", value)} onBegin={onBegin} onEnd={onEnd} onPick={() => onPick(block.id, "src")} t={t} />
          {!block.src ? <p role="status">{t("Choose a resource before testing or exporting.")}</p> : null}
          {block.type === "image" ? <Field spec={{ name: "alt", label: "Image description" }} value={block.alt ?? ""} onChange={(value) => update(block.id, "alt", value)} onBegin={onBegin} onEnd={onEnd} t={t} /> : null}
          {block.type === "video" ? <Field spec={{ name: "poster", label: "Poster image", asset: true }} value={block.poster ?? ""} onChange={(value) => update(block.id, "poster", value)} onBegin={onBegin} onEnd={onEnd} onPick={() => onPick(block.id, "poster")} t={t} /> : null}
        </>}
        <div className="pne-button-grid">
          <button type="button" aria-label={`${t("Move up")}: ${index + 1}`} disabled={index === 0} onClick={() => move(index, -1)}>{t("Move up")}</button>
          <button type="button" aria-label={`${t("Move down")}: ${index + 1}`} disabled={index === popup.blocks.length - 1} onClick={() => move(index, 1)}>{t("Move down")}</button>
          <button type="button" aria-label={`${t("Delete block")}: ${index + 1}`} onClick={() => { onEnd(); onChange({ ...popup, blocks: popup.blocks.filter((item) => item.id !== block.id) }); }}>{t("Delete block")}</button>
        </div>
      </div>
    </fieldset>)}
    <div className="pne-fields">
      <label>{t("Add content block")}
        <select value="" onChange={(event) => {
          const type = event.currentTarget.value as ProjectPopupBlock["type"];
          if (!type) return;
          onEnd();
          const id = newId();
          const block: ProjectPopupBlock = type === "text" ? { id, type, text: "" } : { id, type, src: "" };
          onChange({ ...popup, blocks: [...popup.blocks, block] });
        }}>
          <option value="">{t("Choose content type")}</option>
          {(["text", "image", "video", "audio"] as const).map((type) => <option key={type} value={type}>{t(type)}</option>)}
        </select>
      </label>
    </div>
  </div>;
}
