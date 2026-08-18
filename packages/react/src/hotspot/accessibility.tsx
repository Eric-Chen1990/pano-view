import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";

type HotspotActivationEvent = KeyboardEvent | MouseEvent;

type HotspotAccessibilityEntry = {
  id: string;
  label: string;
  token: symbol;
  activate: (event: HotspotActivationEvent) => void;
  onFocusChange: (focused: boolean) => void;
};

type HotspotAccessibilityRegistry = {
  register: (
    entry: Omit<HotspotAccessibilityEntry, "token">,
  ) => () => void;
};

export const HotspotAccessibilityContext =
  createContext<HotspotAccessibilityRegistry | null>(null);

function warnAboutMissingLabel(id: string) {
  const nodeEnv = (
    globalThis as typeof globalThis & {
      process?: { env?: { NODE_ENV?: string } };
    }
  ).process?.env?.NODE_ENV;
  if (nodeEnv !== "production") {
    console.warn(
      `Hotspot "${id}" is clickable but has no ariaLabel, so it is unavailable to keyboard and screen-reader users.`,
    );
  }
}

export function useHotspotAccessibility({
  id,
  ariaLabel,
  onActivate,
}: {
  id: string;
  ariaLabel?: string;
  onActivate?: (event: HotspotActivationEvent) => void;
}): boolean {
  const registry = useContext(HotspotAccessibilityContext);
  const [focused, setFocused] = useState(false);
  const activateRef = useRef(onActivate);
  const enabled = Boolean(onActivate);
  activateRef.current = onActivate;

  useEffect(() => {
    if (!enabled) {
      setFocused(false);
      return;
    }
    if (!ariaLabel) {
      warnAboutMissingLabel(id);
      return;
    }
    if (!registry) {
      return;
    }

    return registry.register({
      id,
      label: ariaLabel,
      activate: (event) => activateRef.current?.(event),
      onFocusChange: setFocused,
    });
  }, [ariaLabel, enabled, id, registry]);

  return focused;
}

export function useHotspotAccessibilityLayer(): {
  controls: ReactNode;
  registry: HotspotAccessibilityRegistry;
} {
  const [entries, setEntries] = useState<
    Map<string, HotspotAccessibilityEntry>
  >(() => new Map());

  const register = useCallback(
    (entry: Omit<HotspotAccessibilityEntry, "token">) => {
      const token = Symbol(entry.id);
      const nextEntry: HotspotAccessibilityEntry = { ...entry, token };
      setEntries((current) => {
        const next = new Map(current);
        next.set(entry.id, nextEntry);
        return next;
      });

      return () => {
        setEntries((current) => {
          if (current.get(entry.id)?.token !== token) {
            return current;
          }
          const next = new Map(current);
          next.delete(entry.id);
          return next;
        });
      };
    },
    [],
  );

  const registry = useMemo<HotspotAccessibilityRegistry>(
    () => ({ register }),
    [register],
  );
  const controls = useMemo(
    () => (
      <div aria-label="Panorama hotspots" style={{ pointerEvents: "none" }}>
        {Array.from(entries.values()).map((entry) => (
          <button
            aria-label={entry.label}
            className="sr-only"
            key={entry.id}
            onBlur={() => entry.onFocusChange(false)}
            onClick={(event) => entry.activate(event.nativeEvent)}
            onFocus={() => entry.onFocusChange(true)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                entry.activate(event.nativeEvent);
              }
            }}
            type="button"
          >
            {entry.label}
          </button>
        ))}
      </div>
    ),
    [entries],
  );

  return { controls, registry };
}
