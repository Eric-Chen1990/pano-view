import { createContext } from "react";
import type { PanoramaPointerEvent } from "./hotspot/types";
import type { PanoViewerState } from "./types";

export type ViewInteractionSource = "mouse" | "touch" | "keyboard";

export type PanoWheelEvent = {
  /** Signed wheel delta (same sign convention as WheelEvent.deltaY). */
  delta: number;
  nativeEvent: WheelEvent;
};

export type PanoResizeEvent = {
  width: number;
  height: number;
};

export type ViewInteractionEvent = {
  source: ViewInteractionSource;
};

export type PanoEventMap = {
  viewchange: PanoViewerState;
  viewsettled: PanoViewerState;
  viewinteractionstart: ViewInteractionEvent;
  viewinteractionend: ViewInteractionEvent;
  click: PanoramaPointerEvent;
  doubleclick: PanoramaPointerEvent;
  pointerdown: PanoramaPointerEvent;
  pointerup: PanoramaPointerEvent;
  pointermove: PanoramaPointerEvent;
  contextmenu: PanoramaPointerEvent;
  wheel: PanoWheelEvent;
  idle: undefined;
  idleend: undefined;
  enterfullscreen: undefined;
  exitfullscreen: undefined;
  resize: PanoResizeEvent;
  autorotatestart: undefined;
  autorotatestop: undefined;
  autorotateoneround: undefined;
};

export type PanoEventType = keyof PanoEventMap;

export type PanoEventListener<T extends PanoEventType> = (
  payload: PanoEventMap[T],
) => void;

export type PanoEventBus = {
  subscribe: <T extends PanoEventType>(
    type: T,
    listener: PanoEventListener<T>,
  ) => () => void;
  emit: <T extends PanoEventType>(type: T, payload: PanoEventMap[T]) => void;
};

export function createPanoEventBus(): PanoEventBus {
  const listeners = new Map<PanoEventType, Set<PanoEventListener<PanoEventType>>>();

  return {
    subscribe(type, listener) {
      let set = listeners.get(type);
      if (!set) {
        set = new Set();
        listeners.set(type, set);
      }
      set.add(listener as PanoEventListener<PanoEventType>);
      return () => {
        set?.delete(listener as PanoEventListener<PanoEventType>);
        if (set && set.size === 0) {
          listeners.delete(type);
        }
      };
    },
    emit(type, payload) {
      const set = listeners.get(type);
      if (!set || set.size === 0) {
        return;
      }
      for (const listener of [...set]) {
        (listener as PanoEventListener<typeof type>)(payload);
      }
    },
  };
}

export const PanoEventBusContext = createContext<PanoEventBus | null>(null);
