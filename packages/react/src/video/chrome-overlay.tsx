import { createContext, useCallback, useMemo, useState } from "react";
import type { ReactElement } from "react";

export type PanoChromeOverlayApi = {
  overlayElement: HTMLDivElement | null;
};

export const PanoChromeOverlayContext =
  createContext<PanoChromeOverlayApi | null>(null);

/**
 * Creates a screen-space chrome overlay for PanoViewer. Provide `api`
 * inside the Canvas (R3F does not inherit outer React context) and render
 * `overlay` as a DOM sibling of the Canvas. HTML chrome must render as
 * children of the overlay node in the outer React tree — not via portals
 * from inside the R3F tree.
 */
export function usePanoChromeOverlay(): {
  api: PanoChromeOverlayApi;
  overlay: ReactElement;
  setOverlayNode: (node: HTMLDivElement | null) => void;
  overlayElement: HTMLDivElement | null;
} {
  const [overlayElement, setOverlayElement] = useState<HTMLDivElement | null>(
    null,
  );
  const setOverlayNode = useCallback((node: HTMLDivElement | null) => {
    setOverlayElement(node);
  }, []);
  const api = useMemo<PanoChromeOverlayApi>(
    () => ({ overlayElement }),
    [overlayElement],
  );

  const overlay = (
    <div
      className="pointer-events-none absolute inset-0 z-[15]"
      data-pano-chrome-overlay=""
      ref={setOverlayNode}
    />
  );

  return { api, overlay, setOverlayNode, overlayElement };
}
