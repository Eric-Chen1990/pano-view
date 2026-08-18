import { useFrame, useThree } from "@react-three/fiber";
import { useContext, useEffect, useMemo, useRef } from "react";
import { useClaimControlChannel } from "./control-claims";
import { PanoramaViewContext } from "./panorama-view-runtime";

const DEFAULT_ROTATE_SPEED = 60;
const DEFAULT_ZOOM_SPEED = 30;
const DEFAULT_SHIFT_MULTIPLIER = 3;

export type KeyboardControlAction =
  | "left"
  | "right"
  | "up"
  | "down"
  | "zoomIn"
  | "zoomOut"
  | "previousScene"
  | "nextScene"
  | "reset";

export type KeyboardControlKeys = Partial<
  Record<KeyboardControlAction, string | readonly string[]>
>;

/** Options for keyboard-driven panorama navigation. */
export type KeyboardControlsProps = {
  /** Whether keyboard handling is active. Defaults to true. */
  enabled?: boolean;
  /**
   * Custom key bindings. Each action accepts a key, code, or list of either.
   * Matching is case-insensitive for `event.key` and exact for `event.code`.
   */
  keys?: KeyboardControlKeys;
  /** Yaw/pitch change rate in degrees per second. Defaults to 60. */
  rotateSpeed?: number;
  /** FOV change rate in degrees per second. Defaults to 30. */
  zoomSpeed?: number;
  /** Speed multiplier while Shift is held. Defaults to 3. */
  shiftMultiplier?: number;
  /** Inverts up/down look direction. Defaults to false. */
  invert?: boolean;
  /**
   * Maximum FOV change rate in degrees per second. When omitted, no extra
   * rate cap is applied. Usually supplied by PanoViewer from `controls.fovSpeed`.
   */
  fovSpeed?: number;
  /** Called once when the previous-scene binding is pressed. */
  onPreviousScene?: () => void;
  /** Called once when the next-scene binding is pressed. */
  onNextScene?: () => void;
};

const DEFAULT_KEYS: Record<KeyboardControlAction, readonly string[]> = {
  left: ["ArrowLeft"],
  right: ["ArrowRight"],
  up: ["ArrowUp"],
  down: ["ArrowDown"],
  zoomIn: ["+", "="],
  zoomOut: ["-", "_"],
  previousScene: ["[", "PageUp"],
  nextScene: ["]", "PageDown"],
  reset: ["0"],
};

const CONTINUOUS_ACTIONS = new Set<KeyboardControlAction>([
  "left",
  "right",
  "up",
  "down",
  "zoomIn",
  "zoomOut",
]);

function normalizeBinding(value: string | readonly string[] | undefined): string[] {
  if (value === undefined) {
    return [];
  }
  return (typeof value === "string" ? [value] : [...value]).filter(
    (entry) => entry.length > 0,
  );
}

function resolveKeyMap(
  overrides: KeyboardControlKeys | undefined,
): Map<string, KeyboardControlAction> {
  const map = new Map<string, KeyboardControlAction>();
  for (const action of Object.keys(DEFAULT_KEYS) as KeyboardControlAction[]) {
    const bindings =
      overrides && action in overrides
        ? normalizeBinding(overrides[action])
        : [...DEFAULT_KEYS[action]];
    for (const binding of bindings) {
      map.set(binding.toLowerCase(), action);
    }
  }
  return map;
}

function matchAction(
  event: KeyboardEvent,
  keyMap: Map<string, KeyboardControlAction>,
): KeyboardControlAction | null {
  return (
    keyMap.get(event.key.toLowerCase()) ??
    keyMap.get(event.code.toLowerCase()) ??
    null
  );
}

function resolveSpeed(value: number | undefined, fallback: number): number {
  return Number.isFinite(value) && value! >= 0 ? value! : fallback;
}

/**
 * Returns the scene id `step` positions away from `activeSceneId` in
 * `scenes`, wrapping at both ends. Returns `null` when the list is empty or
 * the active id is missing.
 */
export function cycleSceneId(
  scenes: readonly { id: string }[],
  activeSceneId: string,
  step: 1 | -1,
): string | null {
  if (scenes.length === 0) {
    return null;
  }
  const index = scenes.findIndex((scene) => scene.id === activeSceneId);
  if (index < 0) {
    return null;
  }
  const nextIndex = (index + step + scenes.length) % scenes.length;
  return scenes[nextIndex]?.id ?? null;
}

/**
 * Adds keyboard navigation to the nearest PanoViewer. Enabled by default;
 * render this component only to override properties, bindings, or scene
 * callbacks. Hold movement/zoom keys for continuous motion; scene and reset
 * bindings fire once per key press.
 */
export function KeyboardControls({
  enabled = true,
  keys,
  rotateSpeed = DEFAULT_ROTATE_SPEED,
  zoomSpeed = DEFAULT_ZOOM_SPEED,
  shiftMultiplier = DEFAULT_SHIFT_MULTIPLIER,
  invert = false,
  fovSpeed,
  onPreviousScene,
  onNextScene,
}: KeyboardControlsProps) {
  useClaimControlChannel("keyboard");
  const controlsRef = useContext(PanoramaViewContext);
  const { gl } = useThree();
  const pressedRef = useRef(new Set<KeyboardControlAction>());
  const shiftHeldRef = useRef(false);
  const invertRef = useRef(invert);
  const fovSpeedRef = useRef(fovSpeed);
  const onPreviousSceneRef = useRef(onPreviousScene);
  const onNextSceneRef = useRef(onNextScene);
  const keyMap = useMemo(() => resolveKeyMap(keys), [keys]);

  if (!controlsRef) {
    throw new Error("<KeyboardControls> must be rendered inside <PanoViewer>.");
  }

  invertRef.current = invert;
  fovSpeedRef.current = fovSpeed;
  onPreviousSceneRef.current = onPreviousScene;
  onNextSceneRef.current = onNextScene;

  useEffect(() => {
    const element = gl.domElement;
    if (!enabled) {
      pressedRef.current.clear();
      shiftHeldRef.current = false;
      controlsRef.current?.setKeyboardActive(false);
      return;
    }

    const syncKeyboardActive = () => {
      let continuous = false;
      for (const action of pressedRef.current) {
        if (CONTINUOUS_ACTIONS.has(action)) {
          continuous = true;
          break;
        }
      }
      controlsRef.current?.setKeyboardActive(continuous);
    };

    const clearPressed = () => {
      pressedRef.current.clear();
      shiftHeldRef.current = false;
      controlsRef.current?.setKeyboardActive(false);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Shift") {
        shiftHeldRef.current = true;
      }

      const action = matchAction(event, keyMap);
      if (!action) {
        return;
      }

      if (controlsRef.current?.isInteractionLocked()) {
        return;
      }

      event.preventDefault();

      if (action === "reset") {
        if (!event.repeat) {
          controlsRef.current?.reset();
        }
        return;
      }

      if (action === "previousScene") {
        if (!event.repeat) {
          onPreviousSceneRef.current?.();
        }
        return;
      }

      if (action === "nextScene") {
        if (!event.repeat) {
          onNextSceneRef.current?.();
        }
        return;
      }

      pressedRef.current.add(action);
      syncKeyboardActive();
    };

    const onKeyUp = (event: KeyboardEvent) => {
      if (event.key === "Shift") {
        shiftHeldRef.current = false;
      }

      const action = matchAction(event, keyMap);
      if (!action || !CONTINUOUS_ACTIONS.has(action)) {
        return;
      }

      pressedRef.current.delete(action);
      syncKeyboardActive();
    };

    const onBlur = () => {
      clearPressed();
    };

    element.addEventListener("keydown", onKeyDown);
    element.addEventListener("keyup", onKeyUp);
    element.addEventListener("blur", onBlur);
    window.addEventListener("blur", onBlur);

    return () => {
      element.removeEventListener("keydown", onKeyDown);
      element.removeEventListener("keyup", onKeyUp);
      element.removeEventListener("blur", onBlur);
      window.removeEventListener("blur", onBlur);
      clearPressed();
    };
  }, [controlsRef, enabled, gl, keyMap]);

  useFrame((_, deltaSeconds) => {
    if (!enabled || pressedRef.current.size === 0) {
      return;
    }

    const controls = controlsRef.current;
    if (!controls) {
      return;
    }

    const multiplier = shiftHeldRef.current
      ? resolveSpeed(shiftMultiplier, DEFAULT_SHIFT_MULTIPLIER)
      : 1;
    const rotation =
      resolveSpeed(rotateSpeed, DEFAULT_ROTATE_SPEED) * multiplier * deltaSeconds;
    let zoom =
      resolveSpeed(zoomSpeed, DEFAULT_ZOOM_SPEED) * multiplier * deltaSeconds;
    const fovCap = fovSpeedRef.current;
    if (Number.isFinite(fovCap) && fovCap! >= 0) {
      zoom = Math.min(zoom, fovCap! * deltaSeconds);
    }

    const pitchSign = invertRef.current ? -1 : 1;
    let yaw = 0;
    let pitch = 0;
    let fov = 0;

    for (const action of pressedRef.current) {
      switch (action) {
        case "left":
          yaw -= rotation;
          break;
        case "right":
          yaw += rotation;
          break;
        case "up":
          pitch += pitchSign * rotation;
          break;
        case "down":
          pitch -= pitchSign * rotation;
          break;
        case "zoomIn":
          fov -= zoom;
          break;
        case "zoomOut":
          fov += zoom;
          break;
        case "previousScene":
        case "nextScene":
        case "reset":
          break;
        default: {
          const _exhaustive: never = action;
          void _exhaustive;
          break;
        }
      }
    }

    if (yaw !== 0 || pitch !== 0 || fov !== 0) {
      controls.applyViewDelta({ yaw, pitch, fov });
    }
  });

  return null;
}
