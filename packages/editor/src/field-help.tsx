import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

const HelpContainer = createContext<HTMLDivElement | null>(null);

/** Keep floating help inside the editor, including when it enters API fullscreen. */
export function FieldHelpProvider({ children }: { children: ReactNode }) {
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  return (
    <HelpContainer value={container}>
      {children}
      <div ref={setContainer} className="pne-help-container" />
    </HelpContainer>
  );
}

export function FieldHelp({
  id,
  label,
  name,
  help,
  action,
}: {
  id: string;
  label: string;
  name: string;
  help: string;
  action: string;
}) {
  const container = useContext(HelpContainer);
  const trigger = useRef<HTMLButtonElement>(null);
  const bubble = useRef<HTMLDivElement>(null);
  const pinned = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({
    left: 0,
    top: 0,
    width: 0,
    maxHeight: 0,
  });
  const cancelClose = () => clearTimeout(timer.current);
  const close = () => {
    cancelClose();
    pinned.current = false;
    setOpen(false);
  };
  const leave = () => {
    cancelClose();
    timer.current = setTimeout(() => {
      if (!pinned.current && document.activeElement !== trigger.current)
        setOpen(false);
    }, 120);
  };
  useEffect(() => () => clearTimeout(timer.current), []);
  useLayoutEffect(() => {
    if (!open || !container) return;
    const place = () => {
      if (!trigger.current || !bubble.current) return;
      const host = container.getBoundingClientRect();
      const anchor = trigger.current.getBoundingClientRect();
      const viewport = document.documentElement;
      const left = Math.max(0, host.left) + 8;
      const right = Math.min(viewport.clientWidth, host.right) - 8;
      const top = Math.max(0, host.top) + 8;
      const bottom = Math.min(viewport.clientHeight, host.bottom) - 8;
      const width = Math.max(0, Math.min(320, right - left));
      const height = bubble.current.scrollHeight + 2;
      const below = bottom - anchor.bottom - 8;
      const above = anchor.top - top - 8;
      const useBelow = below >= height || below >= above;
      const maxHeight = Math.max(0, useBelow ? below : above);
      setPosition({
        width,
        maxHeight,
        left: Math.max(left, Math.min(anchor.left, right - width)) - host.left,
        top:
          (useBelow
            ? anchor.bottom + 8
            : Math.max(top, anchor.top - Math.min(height, maxHeight) - 8)) -
          host.top,
      });
    };
    place();
    const observer = new ResizeObserver(place);
    observer.observe(container);
    observer.observe(bubble.current!);
    window.addEventListener("resize", place);
    // Scrolling can hide the anchor; dismiss instead of leaving detached help visible.
    const scroll = (event: Event) => {
      if (!bubble.current?.contains(event.target as Node)) close();
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        close();
      }
    };
    const outside = (event: PointerEvent) => {
      if (
        !trigger.current?.contains(event.target as Node) &&
        !bubble.current?.contains(event.target as Node)
      )
        close();
    };
    document.addEventListener("scroll", scroll, true);
    document.addEventListener("keydown", escape, true);
    document.addEventListener("pointerdown", outside, true);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", place);
      document.removeEventListener("scroll", scroll, true);
      document.removeEventListener("keydown", escape, true);
      document.removeEventListener("pointerdown", outside, true);
    };
  }, [open, container]);
  return (
    <>
      <button
        ref={trigger}
        type="button"
        className="pne-help-button"
        aria-label={`${action}: ${label}`}
        aria-expanded={open}
        aria-describedby={open ? id : undefined}
        aria-controls={open ? id : undefined}
        onMouseEnter={() => {
          cancelClose();
          setOpen(true);
        }}
        onMouseLeave={leave}
        onFocus={() => setOpen(true)}
        onBlur={(event) => {
          if (!bubble.current?.contains(event.relatedTarget as Node | null))
            close();
        }}
        onClick={() => {
          pinned.current = !pinned.current;
          setOpen(pinned.current);
        }}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="9" />
          <path d="M9.5 9a2.5 2.5 0 0 1 5 0c0 2-2.5 2-2.5 4M12 16.5h.01" />
        </svg>
      </button>
      {open && container
        ? createPortal(
            <div
              ref={bubble}
              id={id}
              role="tooltip"
              className="pne-help-bubble"
              style={position}
              onMouseEnter={cancelClose}
              onMouseLeave={leave}
            >
              <strong>{label}</strong>
              <code>{name}</code>
              <p>{help}</p>
            </div>,
            container
          )
        : null}
    </>
  );
}
