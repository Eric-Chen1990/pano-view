import type { WebVRInputState, WebVRInteractionMode } from './types';
import type { PanoSpatialControlAdapter } from '../spatial/host';

export type InputSource = { hand?: unknown; targetRayMode: string };
export type PointerInput = { pointerId: number; pointerState?: { inputSource?: InputSource; gamepad?: Record<string, { xAxis?: number; yAxis?: number }> } };
export function pointerInput(event: unknown): PointerInput { return event as PointerInput; }
export function pointerStick(event: PointerInput) { return event.pointerState?.gamepad?.['xr-standard-thumbstick']; }

/** Session-local arbitration. Pose and axis updates never enter React state. */
export function createVRInput() {
  let policy: WebVRInteractionMode = 'auto';
  let xr = false;
  let active: InputSource | null = null;
  let stick = false;
  let state: WebVRInputState = { mode: null, source: null };
  const listeners = new Set<() => void>();
  const cancellations = new Set<() => void>();
  const consumed = new Set<number>();
  const owners = new Map<object, number>();
  const cancel = () => { cancellations.forEach(fn => fn()); owners.clear(); };
  const publish = (mode: WebVRInputState['mode'], source: WebVRInputState['source'], hasStick = false) => {
    if (state.mode === mode && state.source === source && stick === hasStick) return;
    cancel();
    stick = hasStick;
    state = Object.freeze({ mode, source });
    listeners.forEach(fn => fn());
  };
  return {
    getSnapshot: () => state,
    subscribe(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; },
    onCancel(fn: () => void) { cancellations.add(fn); return () => { cancellations.delete(fn); }; },
    cancel,
    configure(mode: string | null, nextPolicy: WebVRInteractionMode) {
      cancel(); xr = mode === 'webxr'; policy = nextPolicy; active = null; consumed.clear();
      publish(mode === null ? null : policy === 'gaze' || (policy === 'auto' && !xr) ? 'gaze' : 'pointer', null);
    },
    enableGaze() { if (policy === 'auto') { active = null; publish('gaze', 'head'); } },
    enablePointer() { if (policy === 'auto') { active = null; publish('pointer', null); } },
    get canSwitch() { return policy === 'auto'; },
    get hasStick() { return state.mode === 'pointer' && stick; },
    get canDrag() { return state.mode === 'pointer' && state.source === 'controller'; },
    get activeSource() { return active; },
    observe(source: InputSource, tracked: boolean, hasStick: boolean) {
      if (active !== source) return;
      if (!tracked && source.targetRayMode !== 'transient-pointer' && source.targetRayMode !== 'screen') publish('paused', state.source);
      else if (state.mode === 'pointer' && stick !== hasStick) publish('pointer', state.source, hasStick);
    },
    accept(event: PointerInput, phase: 'hover' | 'down' | 'up' | 'click', hasStick = false) {
      const source = event.pointerState?.inputSource;
      if (!source) return state.mode !== 'paused';
      if (!xr || policy === 'gaze') return false;
      if (phase === 'down') {
        consumed.delete(event.pointerId);
        if (owners.size && active !== source) { consumed.add(event.pointerId); return false; }
      }
      if (phase === 'click' && consumed.delete(event.pointerId)) return false;
      if (phase !== 'down' && consumed.has(event.pointerId)) return false;
      if (state.mode !== 'pointer') {
        if (phase !== 'down') return false;
        active = source;
        publish('pointer', source.hand ? 'hand' : source.targetRayMode === 'tracked-pointer' ? 'controller' : 'system', hasStick);
        consumed.add(event.pointerId);
        return false;
      }
      if (phase === 'down' || phase === 'hover' && !owners.size) {
        active = source;
        publish('pointer', source.hand ? 'hand' : source.targetRayMode === 'tracked-pointer' ? 'controller' : 'system', hasStick);
      }
      return true;
    },
    claim(target: object, pointerId: number) {
      const owner = owners.get(target);
      if (owner !== undefined && owner !== pointerId) return false;
      owners.set(target, pointerId); return true;
    },
    release(target: object, pointerId: number) { if (owners.get(target) === pointerId) owners.delete(target); },
  };
}

export function axisValue(value: number | undefined): number {
  if (!Number.isFinite(value) || Math.abs(value!) <= .2) return 0;
  return Math.sign(value!) * Math.min(1, (Math.abs(value!) - .2) / .8);
}

export function applySpatialAxes(
  adapter: PanoSpatialControlAdapter | null,
  scroll: Pick<HTMLElement, 'isConnected' | 'scrollTop' | 'scrollLeft' | 'clientHeight' | 'clientWidth'> | null,
  x: number, y: number, seconds: number,
) {
  if (!Number.isFinite(seconds) || seconds <= 0 || seconds > .25) return;
  const dt = Math.min(seconds, .048);
  if (adapter?.zoomBy) {
    if (y && adapter.canExecute?.(y < 0 ? 'in' : 'out') !== false) adapter.zoomBy(1.5 ** (-y * dt));
  } else if (scroll?.isConnected) {
    scroll.scrollTop += y * scroll.clientHeight * dt;
    scroll.scrollLeft += x * scroll.clientWidth * dt;
  }
}
