import {
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";

export type InspectorTab = {
  id: string;
  label: string;
  content: ReactNode;
};

export function InspectorTabs({
  tabs,
  activeId,
  onChange,
}: {
  tabs: InspectorTab[];
  activeId?: string;
  onChange?: (id: string) => void;
}) {
  const listId = useId();
  const listRef = useRef<HTMLDivElement>(null);
  const controlled = activeId !== undefined && onChange !== undefined;
  const [internal, setInternal] = useState(tabs[0]?.id);
  const selected =
    tabs.find((tab) => tab.id === (controlled ? activeId : internal))?.id ??
    tabs[0]?.id;
  const active = tabs.find((tab) => tab.id === selected) ?? tabs[0];

  function select(id: string) {
    if (controlled) onChange?.(id);
    else setInternal(id);
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const keys = ["ArrowLeft", "ArrowRight", "Home", "End"];
    if (!keys.includes(event.key) || !tabs.length) return;
    event.preventDefault();
    const index = Math.max(
      0,
      tabs.findIndex((tab) => tab.id === selected),
    );
    const next =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? tabs.length - 1
          : (index + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) %
            tabs.length;
    const id = tabs[next]!.id;
    select(id);
    listRef.current
      ?.querySelector<HTMLElement>(`[data-tab-id="${id}"]`)
      ?.focus();
  }

  if (!active) return null;

  return (
    <div className="pne-inspector-tabs">
      <div
        ref={listRef}
        className="pne-tablist"
        role="tablist"
        aria-label={listId}
        onKeyDown={onKeyDown}
      >
        {tabs.map((tab) => {
          const pressed = tab.id === selected;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              data-tab-id={tab.id}
              id={`${listId}-${tab.id}`}
              aria-selected={pressed}
              aria-controls={`${listId}-panel-${tab.id}`}
              tabIndex={pressed ? 0 : -1}
              onClick={() => select(tab.id)}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      {tabs.map((tab) => {
        const pressed = tab.id === selected;
        return (
          <div
            key={tab.id}
            className="pne-tabpanel"
            role="tabpanel"
            id={`${listId}-panel-${tab.id}`}
            aria-labelledby={`${listId}-${tab.id}`}
            hidden={!pressed}
          >
            {tab.content}
          </div>
        );
      })}
    </div>
  );
}
