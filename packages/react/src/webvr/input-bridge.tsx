import { useContext, useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useXRInputSourceStates } from '@react-three/xr';
import { CanvasTexture, Group, Mesh, Raycaster, Vector3 } from 'three';
import { SpatialHostContext } from '../spatial/host';
import { createGazeActionState } from '../spatial/gaze-action';
import { SPATIAL_UI_LAYER } from '../spatial/render-layer';
import { WebVRRuntimeContext, updateWebVRHost } from './host';
import { pointerInput, pointerStick } from './input';
import type { WebVRChrome, WebVRInteractionMode, WebVRMode } from './types';

export function WebVRInputBridge({ mode, policy, chrome, gazeEnabled }: {
  mode: WebVRMode | null; policy: WebVRInteractionMode; chrome: WebVRChrome; gazeEnabled: boolean;
}) {
  const spatial = useContext(SpatialHostContext)!;
  const runtime = useContext(WebVRRuntimeContext)!;
  const sources = useXRInputSourceStates();
  const { camera, gl } = useThree();
  const input = spatial.input;
  useEffect(() => {
    const sync = () => { spatial.action = null; spatial.notify(); updateWebVRHost(runtime.host, { input: input.getSnapshot() }); };
    const unsubscribe = input.subscribe(sync);
    input.configure(mode, policy); sync();
    return () => { unsubscribe(); input.cancel(); };
  }, [input, mode, policy, runtime.host, spatial]);
  useEffect(() => {
    const stop = () => input.cancel();
    window.addEventListener('blur', stop);
    document.addEventListener('visibilitychange', stop);
    return () => { window.removeEventListener('blur', stop); document.removeEventListener('visibilitychange', stop); };
  }, [input]);
  const group = useRef<Group>(null);
  const mesh = useRef<Mesh>(null);
  const anchored = useRef(false);
  const gaze = useRef(createGazeActionState());
  const ray = useMemo(() => { const r = new Raycaster(); r.layers.enableAll(); return r; }, []);
  const direction = useMemo(() => new Vector3(), []);
  const canvas = useMemo(() => { const c = document.createElement('canvas'); c.width = 768; c.height = 128; return c; }, []);
  const painted = useRef("");
  const texture = useMemo(() => new CanvasTexture(canvas), [canvas]);
  useEffect(() => () => texture.dispose(), [texture]);
  useEffect(() => { anchored.current = false; gaze.current.stop(); }, [mode]);
  const action = useMemo(() => ({ id: input, activate: () => input.enableGaze() }), [input]);
  const appearance = typeof chrome === 'object' ? chrome : {};
  const background = typeof appearance.background === 'string' ? appearance.background : 'rgba(16,24,32,.9)';
  const color = appearance.color ? String(appearance.color) : '#ffffff';
  const accent = appearance.accent ? String(appearance.accent) : '#7dd3fc';
  const radius = typeof appearance.borderRadius === 'number' ? Math.max(0, Math.min(64, appearance.borderRadius * 2)) : 12;
  const fontSize = typeof appearance.fontSize === 'number' ? Math.max(16, Math.min(48, appearance.fontSize * 2)) : 28;
  useFrame((_, dt, frame) => {
    const session = gl.xr.getSession();
    if (session && session.visibilityState !== 'visible') { input.cancel(); gaze.current.stop(); return; }
    const active = input.activeSource;
    if (active && mode === 'webxr') {
      const source = sources.find(s => s.inputSource === active);
      const space = gl.xr.getReferenceSpace();
      const tracked = !!source && !!frame && !!space && !!frame.getPose(source.inputSource.targetRaySpace, space);
      input.observe(active, tracked, source?.type === 'controller' && !!source.gamepad['xr-standard-thumbstick']);
    }
    if (!group.current || !mesh.current) return;
    const cam = gl.xr.isPresenting ? gl.xr.getCamera() : camera;
    if (!anchored.current) {
      cam.getWorldPosition(group.current.position);
      cam.getWorldQuaternion(group.current.quaternion);
      group.current.position.add(new Vector3(-.8, -.65, -2).applyQuaternion(group.current.quaternion));
      group.current.traverse(n => n.layers.set(SPATIAL_UI_LAYER));
      anchored.current = true;
    }
    const state = input.getSnapshot();
    let progress = 0;
    if (gazeEnabled && input.canSwitch && state.mode !== 'gaze') {
      cam.getWorldPosition(ray.ray.origin); cam.getWorldDirection(direction); ray.ray.direction.copy(direction);
      group.current.updateWorldMatrix(true, true);
      const hit = ray.intersectObject(mesh.current)[0];
      progress = gaze.current.tick(hit?.uv && hit.uv.x < .72 ? action : null, dt, 1500);
    } else gaze.current.stop();
    const paintKey = `${state.mode}:${input.canSwitch}:${gazeEnabled}:${Math.round(progress * 100)}:${background}:${color}:${accent}:${radius}:${fontSize}`;
    if (painted.current === paintKey) return;
    painted.current = paintKey;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, 768, 128);
    ctx.fillStyle = background;
    ctx.beginPath(); ctx.roundRect(0, 0, 768, 128, radius); ctx.fill();
    ctx.fillStyle = color; ctx.font = `${fontSize}px sans-serif`;
    ctx.fillText(state.mode === 'paused' ? 'Input paused' : state.mode === 'gaze' ? 'Gaze' : 'Pointer', 18, 38);
    ctx.font = '24px sans-serif';
    ctx.fillText(input.canSwitch ? state.mode === 'gaze' ? 'Use pointer' : gazeEnabled ? 'Enable gaze · look here' : 'Gaze disabled' : 'Input set by host', 18, 88);
    ctx.fillText('Exit VR', 598, 75);
    ctx.fillStyle = accent; ctx.fillRect(0, 120, 552 * progress, 8);
    texture.needsUpdate = true;
  });
  if (mode !== 'webxr' || chrome === false) return null;
  return <group ref={group} renderOrder={100001}>
    <mesh ref={mesh} pointerEventsOrder={100} onPointerDown={e => { e.stopPropagation(); input.accept(pointerInput(e), 'down', !!pointerStick(pointerInput(e))); }}
      onClick={e => {
        e.stopPropagation(); if (!input.accept(pointerInput(e), 'click')) return;
        if ((e.uv?.x ?? 0) >= .72) void runtime.host.controller?.exitVR();
        else if (input.canSwitch) { if (input.getSnapshot().mode === 'gaze') input.enablePointer(); else if (gazeEnabled) input.enableGaze(); }
      }} userData={{ panoGazeResolve: (uv: { x: number }) => ({ id: uv.x >= .72 ? runtime : input, activate: () => { if (uv.x >= .72) void runtime.host.controller?.exitVR(); else input.enablePointer(); } }) }}>
      <planeGeometry args={[1.25, .208]} /><meshBasicMaterial map={texture} transparent depthTest={false} depthWrite={false} toneMapped={false} />
    </mesh>
  </group>;
}
