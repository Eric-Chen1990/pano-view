export function isPanelController(source: XRInputSource) {
  return source.targetRayMode === "tracked-pointer" && !source.hand && Boolean(source.gripSpace || source.gamepad);
}

export function hasPanelController(sources: Iterable<XRInputSource>) {
  for (const source of sources) {
    if (isPanelController(source)) return true;
  }
  return false;
}

export function bindPanelGrip(
  session: XRSession,
  canToggle: () => boolean,
  toggle: () => void,
  interrupt: () => void,
) {
  const pressed = new Set<XRInputSource>();
  const reset = () => { pressed.clear(); };
  const start = ({ inputSource }: XRInputSourceEvent) => {
    if (isPanelController(inputSource) && canToggle()) pressed.add(inputSource);
  };
  const finish = ({ inputSource }: XRInputSourceEvent) => {
    if (!pressed.delete(inputSource) || !canToggle()) return;
    for (const source of session.inputSources) {
      if (source === inputSource) {
        toggle();
        return;
      }
    }
  };
  const end = ({ inputSource }: XRInputSourceEvent) => { pressed.delete(inputSource); };
  const sourcesChanged = ({ removed }: XRInputSourcesChangeEvent) => {
    if (!removed.some(isPanelController)) return;
    reset();
    interrupt();
  };
  const visibilityChanged = () => {
    reset();
    if (session.visibilityState !== "visible") interrupt();
  };
  session.addEventListener("squeezestart", start);
  session.addEventListener("squeeze", finish);
  session.addEventListener("squeezeend", end);
  session.addEventListener("inputsourceschange", sourcesChanged);
  session.addEventListener("visibilitychange", visibilityChanged);
  return {
    reset,
    dispose() {
      reset();
      session.removeEventListener("squeezestart", start);
      session.removeEventListener("squeeze", finish);
      session.removeEventListener("squeezeend", end);
      session.removeEventListener("inputsourceschange", sourcesChanged);
      session.removeEventListener("visibilitychange", visibilityChanged);
    },
  };
}
