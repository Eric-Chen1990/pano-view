import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ComponentProps,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import {
  SpatialHostContext,
  type PanoSpatialControlAdapter,
} from "../spatial/host";
import { usePanoOverlay } from "../overlay/pano-overlay";
import {
  CONTROL_PATHS,
  mediaActions,
  modelActions,
  scrollActions,
  type PanoControlAction,
  type PanoMediaController,
} from "./actions";

export const controlBindings = new WeakMap<HTMLElement, PanoControlAction>();
export const explicitTargets = new WeakMap<object, number>();
const targetListeners = new Set<() => void>();
export function subscribeExplicitTargets(listener: () => void) {
  targetListeners.add(listener);
  return () => { targetListeners.delete(listener); };
}
/** Automatic controls must not claim the target from a host's explicit controls. */
export const AutomaticControlContext = createContext(false);
function useVR() {
  const host = useContext(SpatialHostContext);
  useSyncExternalStore(
    host?.subscribe ?? (() => () => {}),
    host?.getSnapshot ?? (() => 0),
    () => 0
  );
  return host?.mode ?? false;
}
export function PanoControlButton({
  action,
  children,
  ...props
}: Omit<ComponentProps<"button">, "ref"> & { action: PanoControlAction }) {
  const vr = useVR();
  const ref = useRef<HTMLButtonElement>(null);
  const [, refresh] = useState(0);
  useEffect(() => {
    if (!vr || !action.enabled) return;
    const timer = setInterval(() => refresh((value) => value + 1), 200);
    return () => clearInterval(timer);
  }, [vr, action.enabled]);
  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    controlBindings.set(node, action);
    return () => {
      controlBindings.delete(node);
    };
  }, [action, vr]);
  if (!vr) return null;
  return (
    <button
      {...props}
      ref={ref}
      type="button"
      className={`pano-control-button ${props.className ?? ""}`}
      aria-label={props["aria-label"] ?? action.label}
      disabled={
        props.disabled || action.disabled || action.enabled?.() === false
      }
      onClick={(event) => {
        props.onClick?.(event);
        if (!event.defaultPrevented) {
          if (action.activate) action.activate();
          else
            action.update?.(
              action.repeatIntervalMs ? action.repeatIntervalMs / 1000 : 1
            );
        }
      }}
    >
      {children ?? action.icon ?? (
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d={CONTROL_PATHS[action.id] ?? CONTROL_PATHS.reset} />
        </svg>
      )}
    </button>
  );
}
export type PanoControlGroupProps = Omit<ComponentProps<"div">, "children"> & {
  actions: readonly PanoControlAction[];
  children?: (actions: readonly PanoControlAction[]) => ReactNode;
};
export function PanoControlGroup({
  actions,
  children,
  ...props
}: PanoControlGroupProps) {
  const vr = useVR();
  if (!vr) return null;
  return (
    <div
      {...props}
      role="group"
      data-pano-control-group=""
      className={`pano-control-group ${props.className ?? ""}`}
    >
      {children
        ? children(actions)
        : actions.map((action) => (
            <PanoControlButton
              key={
                action.id === "pause"
                  ? "play"
                  : action.id === "unmute"
                  ? "mute"
                  : action.id
              }
              action={action}
            />
          ))}
    </div>
  );
}
type Options = Omit<PanoControlGroupProps, "actions"> & {
  actions?: readonly (string | PanoControlAction)[];
};
function choose(actions: PanoControlAction[], selected?: Options["actions"]) {
  return selected
    ? selected.flatMap((item) =>
        typeof item === "string"
          ? actions.filter((action) => action.id === item)
          : [item]
      )
    : actions;
}
function useTarget(target: object | null) {
  const vr = useVR();
  const automatic = useContext(AutomaticControlContext);
  useEffect(() => {
    if (!target || !vr || automatic) return;
    explicitTargets.set(target, (explicitTargets.get(target) ?? 0) + 1);
    targetListeners.forEach((listener) => listener());
    return () => {
      const count = (explicitTargets.get(target) ?? 1) - 1;
      if (count) explicitTargets.set(target, count);
      else explicitTargets.delete(target);
      targetListeners.forEach((listener) => listener());
    };
  }, [target, vr, automatic]);
}
export function PanoMediaControls({
  controller,
  seekSpeed,
  volumeSpeed,
  actions,
  ...props
}: Options & {
  controller: PanoMediaController | null;
  seekSpeed?: number;
  volumeSpeed?: number;
}) {
  useSyncExternalStore(
    controller?.subscribe ?? (() => () => {}),
    controller?.getSnapshot ?? (() => null),
    () => null
  );
  useTarget(controller);
  const available = mediaActions(controller, seekSpeed, volumeSpeed);
  const ordered = ["rewind", "play", "pause", "forward", "mute", "unmute", "vol-", "vol+"]
    .flatMap((id) => available.filter((action) => action.id === id));
  return (
    <PanoControlGroup
      {...props}
      className={`pano-media-controls ${props.className ?? ""}`}
      actions={choose(ordered, actions)}
    />
  );
}
export function PanoModelControls({
  adapter,
  rotateSpeed,
  zoomSpeed,
  actions,
  ...props
}: Options & {
  adapter: PanoSpatialControlAdapter;
  rotateSpeed?: number;
  zoomSpeed?: number;
}) {
  useTarget(adapter);
  const spatial = useContext(SpatialHostContext);
  const defaults = modelActions(adapter, rotateSpeed, zoomSpeed).filter(action =>
    !(spatial?.input.canDrag && adapter.rotateBy && ["left", "right", "up", "down"].includes(action.id)) &&
    !(spatial?.input.hasStick && adapter.zoomBy && ["in", "out"].includes(action.id)));
  return (
    <PanoControlGroup
      {...props}
      actions={actions || props.children ? choose(modelActions(adapter, rotateSpeed, zoomSpeed), actions) : defaults}
    />
  );
}
export function PanoScrollControls({
  targetRef,
  speed,
  repeatIntervalMs,
  actions,
  ...props
}: Options & {
  targetRef: RefObject<HTMLElement | null>;
  speed?: number;
  repeatIntervalMs?: number;
}) {
  const vr = useVR();
  const [, refresh] = useState(0);
  const [placement, setPlacement] = useState<{
    container: HTMLElement;
    left: number;
    top: number;
    width: number;
    height: number;
  } | null>(null);
  useEffect(() => {
    const target = targetRef.current;
    if (!target || !vr) return;
    const update = () => {
      const container =
        target.offsetParent instanceof HTMLElement
          ? target.offsetParent
          : target.parentElement;
      if (container) {
        const bounds = target.getBoundingClientRect(),
          parent = container.getBoundingClientRect();
        setPlacement({
          container,
          left:
            bounds.left -
            parent.left +
            container.scrollLeft -
            container.clientLeft,
          top:
            bounds.top - parent.top + container.scrollTop - container.clientTop,
          width: bounds.width,
          height: bounds.height,
        });
      }
      refresh((value) => value + 1);
    };
    const resize = new ResizeObserver(update);
    resize.observe(target);
    for (const child of target.children) resize.observe(child);
    const mutation = new MutationObserver(update);
    mutation.observe(target, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
    });
    target.addEventListener("scroll", update);
    target.addEventListener("load", update, true);
    update();
    return () => {
      resize.disconnect();
      mutation.disconnect();
      target.removeEventListener("scroll", update);
      target.removeEventListener("load", update, true);
    };
  }, [targetRef, vr]);
  useTarget(targetRef.current);
  const available = choose(
    scrollActions(targetRef.current, speed, repeatIntervalMs),
    actions
  ).filter((action) => action.enabled?.() !== false);
  const spatial = useContext(SpatialHostContext);
  if (!vr || !placement || !available.length || (!actions && !props.children && spatial?.input.hasStick)) return null;
  return createPortal(
    <PanoControlGroup
      {...props}
      aria-label={props["aria-label"] ?? "Scroll content"}
      className={`pano-scroll-controls ${props.className ?? ""}`}
      style={{
        ...props.style,
        position: "absolute",
        left: placement.left,
        top: placement.top,
        width: placement.width,
        height: placement.height,
        pointerEvents: "none",
        padding: 0,
        zIndex: 3,
      }}
      actions={available}
    >
      {props.children ??
        ((items) =>
          items.map((action) => (
            <PanoControlButton
              key={action.id}
              action={action}
              data-scroll-direction={action.id}
            >
              {action.icon ?? (
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path
                    d={
                      CONTROL_PATHS[`scroll-${action.id}`] ??
                      CONTROL_PATHS[action.id]
                    }
                  />
                </svg>
              )}
            </PanoControlButton>
          )))}
    </PanoControlGroup>,
    placement.container
  );
}
export type PanoSpatialControlsProps = {
  children: ReactNode;
  position?: { yaw: number; pitch: number };
  width?: number;
  distance?: number;
  className?: string;
  style?: ComponentProps<"div">["style"];
};
/** Render inside PanoOverlay. The measured DOM stays in the viewer's fullscreen host. */
export function PanoSpatialControls({
  children,
  position,
  width = 28,
  distance = 2,
  className,
  style,
}: PanoSpatialControlsProps) {
  const host = useContext(SpatialHostContext);
  const vr = useVR();
  const { portalContainer } = usePanoOverlay();
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!host || !element || !vr) return;
    const entry = {
      element,
      close: () => {},
      anchor: { position, width, distance },
    };
    host.panels.add(entry);
    host.notify();
    return () => {
      host.panels.delete(entry);
      host.notify();
    };
  }, [
    host,
    vr,
    position?.yaw,
    position?.pitch,
    width,
    distance,
    portalContainer,
  ]);
  return vr && portalContainer
    ? createPortal(
        <div
          ref={ref}
          className={className}
          aria-hidden="true"
          style={{
            position: "absolute",
            left: -20000,
            top: 0,
            width: 640,
            background: "#161b22",
            color: "white",
            pointerEvents: "auto",
            ...style,
          }}
        >
          {children}
        </div>,
        portalContainer
      )
    : null;
}
