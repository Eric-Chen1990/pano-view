import type { PanoProjectDefinition, ProjectPopupBlock, ProjectPopupDefinition } from "@ericchen1990/pano-view/data";
import { Field } from "./fields";
import { newId, popupReferences } from "./document";
import type { Translate } from "./i18n";
import { IconDown, IconTrash, IconUp } from "./icons";
import { LibraryRow, LibrarySection } from "./library-list";

export function PopupLibrary({ project, selectedId, onSelect, onEdit, onAdd, onDelete, t }: {
  project: PanoProjectDefinition; selectedId?: string;
  onSelect: (id: string) => void; onEdit: (id: string) => void;
  onAdd: () => void; onDelete: (id: string) => void; t: Translate;
}) {
  const popups = project.popups ?? [];
  return <div className="pne-popup-library">
    <LibrarySection
      title={t("Popup content")}
      count={popups.length}
      onAdd={onAdd}
      addLabel={t("New shared popup")}
    >
      <p className="pne-field-help pne-library-help">{t("Edit once to update every hotspot that uses this popup.")}</p>
      {popups.length ? (
        <ul className="pne-row-list" aria-label={t("Popup content")}>
          {popups.map((popup) => {
            const references = popupReferences(project, popup.id).length;
            const title = popup.title || t("Untitled popup");
            return (
              <LibraryRow
                key={popup.id}
                selected={selectedId === popup.id}
                label={title}
                detail={`${t("References")}: ${references}`}
                onSelect={() => onSelect(popup.id)}
                onEdit={() => onEdit(popup.id)}
                editLabel={`${t("Edit popup")}: ${title}`}
                onDelete={() => onDelete(popup.id)}
                deleteLabel={`${t("Delete popup")}: ${title}`}
              />
            );
          })}
        </ul>
      ) : (
        <p className="pne-hint">{t("Select or create a shared popup.")}</p>
      )}
    </LibrarySection>
  </div>;
}

export function PopupInspector({ popup, project, onChange, onBegin, onEnd, onPick, onReference, t }: {
  popup: ProjectPopupDefinition; project: PanoProjectDefinition;
  onChange: (popup: ProjectPopupDefinition) => void;
  onBegin: () => void; onEnd: () => void;
  onPick: (blockId: string, field: "src" | "poster") => void;
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
      {refs.length ? <div className="pne-popup-references">
        <p>{t("Deleting this popup also removes its hotspot actions. You can undo the deletion.")}</p>
        {refs.map((ref) => <button type="button" key={`${ref.sceneId}:${ref.hotspotId}:${ref.trigger}`} onClick={() => onReference(ref.sceneId, ref.hotspotId)}>{ref.label}</button>)}
      </div> : null}
    </div>
    {popup.blocks.map((block, index) => <fieldset key={block.id} className="pne-popup-block">
      <legend className="pne-popup-block-legend">
        <span>{index + 1}. {t(block.type)}</span>
        <span className="pne-row-actions">
          <button type="button" className="pne-icon-button" aria-label={`${t("Move up")}: ${index + 1}`} disabled={index === 0} onClick={() => move(index, -1)}><IconUp /></button>
          <button type="button" className="pne-icon-button" aria-label={`${t("Move down")}: ${index + 1}`} disabled={index === popup.blocks.length - 1} onClick={() => move(index, 1)}><IconDown /></button>
          <button type="button" className="pne-icon-button" aria-label={`${t("Delete block")}: ${index + 1}`} onClick={() => { onEnd(); onChange({ ...popup, blocks: popup.blocks.filter((item) => item.id !== block.id) }); }}><IconTrash /></button>
        </span>
      </legend>
      <div className="pne-fields">
        {block.type === "text" ? <Field spec={{ name: "text", label: "Text", type: "textarea" }} value={block.text} onChange={(value) => update(block.id, "text", value)} onBegin={onBegin} onEnd={onEnd} t={t} /> : <>
          <Field spec={{ name: "src", label: "Resource path", asset: true }} value={block.src} onChange={(value) => update(block.id, "src", value)} onBegin={onBegin} onEnd={onEnd} onPick={() => onPick(block.id, "src")} t={t} />
          {!block.src ? <p role="status">{t("Choose a resource before testing or exporting.")}</p> : null}
          {block.type === "image" ? <Field spec={{ name: "alt", label: "Image description" }} value={block.alt ?? ""} onChange={(value) => update(block.id, "alt", value)} onBegin={onBegin} onEnd={onEnd} t={t} /> : null}
          {block.type === "video" ? <Field spec={{ name: "poster", label: "Poster image", asset: true }} value={block.poster ?? ""} onChange={(value) => update(block.id, "poster", value)} onBegin={onBegin} onEnd={onEnd} onPick={() => onPick(block.id, "poster")} t={t} /> : null}
        </>}
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
