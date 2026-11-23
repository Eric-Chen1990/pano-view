import {
  useContext,
  useEffect,
  useRef,
  useState,
  type MutableRefObject,
  type RefObject,
} from "react";
import { PanoEventBusContext } from "../pano-event-bus";
import type { PanoViewerState } from "../types";

const DEFAULT_VIEW: PanoViewerState = { yaw: 0, pitch: 0, fov: 75 };

export type MapViewSubscription = {
  /** Horizontal FOV for sector angle when `followFov` is enabled. */
  fov: number;
  /** Latest yaw; updated without React re-renders. */
  yawRef: MutableRefObject<number>;
};

/**
 * Subscribe to viewer yaw/fov for map sectors rendered outside the Canvas tree.
 * Only FOV changes trigger a React update (sector angle). Yaw is kept in a ref
 * so panorama dragging does not re-render the whole map + spot list.
 */
export function useMapView(
  controlled?: PanoViewerState,
  onYawChange?: RefObject<((yaw: number) => void) | null>,
): MapViewSubscription {
  const eventBus = useContext(PanoEventBusContext);
  const [fov, setFov] = useState((controlled ?? DEFAULT_VIEW).fov);
  const yawRef = useRef((controlled ?? DEFAULT_VIEW).yaw);
  const controlledRef = useRef(controlled);
  controlledRef.current = controlled;

  useEffect(() => {
    if (controlled !== undefined) {
      yawRef.current = controlled.yaw;
      setFov(controlled.fov);
      onYawChange?.current?.(controlled.yaw);
      return;
    }
    if (!eventBus) return;
    return eventBus.subscribe("viewchange", (next) => {
      if (controlledRef.current !== undefined) return;
      yawRef.current = next.yaw;
      onYawChange?.current?.(next.yaw);
      setFov((current) => (current === next.fov ? current : next.fov));
    });
  }, [controlled, eventBus, onYawChange]);

  return {
    fov: controlled?.fov ?? fov,
    yawRef,
  };
}
