import type { ReactNode } from "react";
import { IconEdit, IconPlus, IconTrash } from "./icons";

export function LibrarySection({
  title,
  count,
  onAdd,
  addLabel,
  onDelete,
  deleteLabel,
  children,
  empty,
}: {
  title: string;
  count?: number;
  onAdd?: () => void;
  addLabel?: string;
  onDelete?: () => void;
  deleteLabel?: string;
  children?: ReactNode;
  empty?: ReactNode;
}) {
  return (
    <div className="pne-library-section">
      <div className="pne-panel-title">
        <span className="pne-library-section-label">
          {title}
          {count !== undefined ? <span>{count}</span> : null}
        </span>
        <span className="pne-library-section-actions">
          {onAdd ? (
            <button
              type="button"
              className="pne-icon-button"
              title={addLabel}
              aria-label={addLabel}
              onClick={onAdd}
            >
              <IconPlus />
            </button>
          ) : null}
          {onDelete ? (
            <button
              type="button"
              className="pne-icon-button"
              title={deleteLabel}
              aria-label={deleteLabel}
              onClick={onDelete}
            >
              <IconTrash />
            </button>
          ) : null}
        </span>
      </div>
      {children}
      {empty}
    </div>
  );
}

export function LibraryRow({
  selected,
  label,
  detail,
  onSelect,
  onEdit,
  editLabel,
  onDelete,
  deleteLabel,
  leading,
}: {
  selected?: boolean;
  label: string;
  detail?: ReactNode;
  onSelect: () => void;
  onEdit?: () => void;
  editLabel?: string;
  onDelete?: () => void;
  deleteLabel?: string;
  leading?: ReactNode;
}) {
  return (
    <li className="pne-row" data-selected={selected ? "true" : undefined}>
      {leading}
      <button
        type="button"
        className="pne-row-select"
        aria-pressed={selected}
        title={label}
        onClick={onSelect}
      >
        <b>{label}</b>
        {detail ? <small>{detail}</small> : null}
      </button>
      <div className="pne-row-actions">
        {onEdit ? (
          <button
            type="button"
            className="pne-icon-button"
            title={editLabel}
            aria-label={editLabel}
            onClick={onEdit}
          >
            <IconEdit />
          </button>
        ) : null}
        {onDelete ? (
          <button
            type="button"
            className="pne-icon-button"
            title={deleteLabel}
            aria-label={deleteLabel}
            onClick={onDelete}
          >
            <IconTrash />
          </button>
        ) : null}
      </div>
    </li>
  );
}
