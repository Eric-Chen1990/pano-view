import { useThree } from "@react-three/fiber";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
} from "react";
import type { CSSProperties, ReactNode } from "react";
import { PanoEventBusContext } from "./pano-event-bus";

/** A CSS `cursor` value applied to the panorama canvas. */
export type PanoCursor = NonNullable<CSSProperties["cursor"]>;

/** Canvas cursor values for viewer idle, drag, and hotspot interaction. */
export type PanoCursors = {
  /** Idle canvas cursor. Defaults to `"grab"`. */
  default?: PanoCursor;
  /** Cursor while dragging the panorama with the mouse. Defaults to `"grabbing"`. */
  dragging?: PanoCursor;
  /** Cursor while hovering an interactive hotspot. Defaults to `"pointer"`. */
  hotspot?: PanoCursor;
  /** Cursor while dragging a hotspot. Defaults to `"move"`. */
  hotspotDragging?: PanoCursor;
};

export const DEFAULT_PANO_CURSORS: Required<PanoCursors> = {
  default: "grab",
  dragging: "grabbing",
  hotspot: "pointer",
  hotspotDragging: "move",
};

const PANO_DRAG_CLAIM_ID = "pano-cursor:dragging";

type PanoCursorLayer = "dragging" | "hotspot" | "hotspotDragging" | "hidden";

const LAYER_PRIORITY: Record<PanoCursorLayer, number> = {
  dragging: 1,
  hotspot: 2,
  hotspotDragging: 3,
  hidden: 4,
};

type CursorClaim = {
  layer: PanoCursorLayer;
  cursor?: PanoCursor;
};

export type PanoCursorApi = {
  cursors: Required<PanoCursors>;
  claim: (id: string, layer: PanoCursorLayer, cursor?: PanoCursor) => void;
  release: (id: string) => void;
};

const PanoCursorContext = createContext<PanoCursorApi | null>(null);

export function usePanoCursor(): PanoCursorApi | null {
  return useContext(PanoCursorContext);
}

export function hotspotCursorClaimId(id: string): string {
  return `pano-cursor:hotspot:${id}`;
}

function resolveClaimCursor(
  claim: CursorClaim,
  cursors: Required<PanoCursors>,
): PanoCursor {
  switch (claim.layer) {
    case "dragging":
      return cursors.dragging;
    case "hotspot":
      return claim.cursor ?? cursors.hotspot;
    case "hotspotDragging":
      return claim.cursor ?? cursors.hotspotDragging;
    case "hidden":
      return "none";
    default: {
      const exhaustive: never = claim.layer;
      return exhaustive;
    }
  }
}

function resolveHighestCursor(
  claims: Map<string, CursorClaim>,
  cursors: Required<PanoCursors>,
): PanoCursor {
  let best: CursorClaim | null = null;
  let bestPriority = 0;
  for (const claim of claims.values()) {
    const priority = LAYER_PRIORITY[claim.layer];
    if (priority >= bestPriority) {
      best = claim;
      bestPriority = priority;
    }
  }
  return best ? resolveClaimCursor(best, cursors) : cursors.default;
}

export function resolvePanoCursors(
  value: boolean | PanoCursors | undefined,
): Required<PanoCursors> | null {
  if (value === false) {
    return null;
  }
  if (value === true || value === undefined) {
    return DEFAULT_PANO_CURSORS;
  }
  return {
    default: value.default ?? DEFAULT_PANO_CURSORS.default,
    dragging: value.dragging ?? DEFAULT_PANO_CURSORS.dragging,
    hotspot: value.hotspot ?? DEFAULT_PANO_CURSORS.hotspot,
    hotspotDragging:
      value.hotspotDragging ?? DEFAULT_PANO_CURSORS.hotspotDragging,
  };
}

type PanoCursorControllerProps = {
  cursors: Required<PanoCursors>;
  children?: ReactNode;
};

/**
 * Owns the WebGL canvas cursor. Idle, panorama drag, hotspot hover, and
 * hotspot drag each claim a layer; the highest-priority claim wins.
 */
export function PanoCursorController({
  cursors,
  children,
}: PanoCursorControllerProps) {
  const { gl } = useThree();
  const eventBus = useContext(PanoEventBusContext);
  const claimsRef = useRef(new Map<string, CursorClaim>());
  const cursorsRef = useRef(cursors);
  const appliedCursorRef = useRef<string | null>(null);

  cursorsRef.current = cursors;

  const applyCursor = useCallback(() => {
    const next = resolveHighestCursor(claimsRef.current, cursorsRef.current);
    const element = gl.domElement;
    if (appliedCursorRef.current === next && element.style.cursor === next) {
      return;
    }
    element.style.cursor = next;
    appliedCursorRef.current = next;
  }, [gl]);

  const claim = useCallback(
    (id: string, layer: PanoCursorLayer, cursor?: PanoCursor) => {
      claimsRef.current.set(id, { layer, cursor });
      applyCursor();
    },
    [applyCursor],
  );

  const release = useCallback(
    (id: string) => {
      if (claimsRef.current.delete(id)) {
        applyCursor();
      }
    },
    [applyCursor],
  );

  const api = useMemo<PanoCursorApi>(
    () => ({
      cursors,
      claim,
      release,
    }),
    [claim, cursors, release],
  );

  useEffect(() => {
    const element = gl.domElement;
    const previous = element.style.cursor;
    return () => {
      claimsRef.current.clear();
      appliedCursorRef.current = null;
      element.style.cursor = previous;
    };
  }, [gl]);

  useEffect(() => {
    applyCursor();
  }, [applyCursor, cursors]);

  useEffect(() => {
    if (!eventBus) {
      return;
    }
    const unsubscribeStart = eventBus.subscribe(
      "viewinteractionstart",
      (event) => {
        if (event.source !== "mouse") {
          return;
        }
        claim(PANO_DRAG_CLAIM_ID, "dragging");
      },
    );
    const unsubscribeEnd = eventBus.subscribe("viewinteractionend", (event) => {
      if (event.source !== "mouse") {
        return;
      }
      release(PANO_DRAG_CLAIM_ID);
    });
    return () => {
      unsubscribeStart();
      unsubscribeEnd();
      release(PANO_DRAG_CLAIM_ID);
    };
  }, [claim, eventBus, release]);

  return (
    <PanoCursorContext.Provider value={api}>
      {children}
    </PanoCursorContext.Provider>
  );
}
