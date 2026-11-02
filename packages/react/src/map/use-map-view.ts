import { useContext, useEffect, useRef, useState } from "react";
import { PanoEventBusContext } from "../pano-event-bus";
import type { PanoViewerState } from "../types";

const DEFAULT_VIEW: PanoViewerState = { yaw: 0, pitch: 0, fov: 75 };

/** Subscribe to viewer yaw/fov for map sectors rendered outside the Canvas tree. */
export function useMapView(controlled?: PanoViewerState): PanoViewerState {
  const eventBus = useContext(PanoEventBusContext);
  const [view, setView] = useState(controlled ?? DEFAULT_VIEW);
  const controlledRef = useRef(controlled);
  controlledRef.current = controlled;

  useEffect(() => {
    if (controlled !== undefined) {
      setView(controlled);
      return;
    }
    if (!eventBus) return;
    return eventBus.subscribe("viewchange", (next) => {
      if (controlledRef.current !== undefined) return;
      setView(next);
    });
  }, [controlled, eventBus]);

  return controlled ?? view;
}
