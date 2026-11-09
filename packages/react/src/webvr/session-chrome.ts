const SESSION_CHROME_IDLE_MS = 3000;

/** Session-scoped activity listeners; locked mouse movement is view input only. */
export function bindSessionChromeVisibility(viewer: Element | null, keepVisible: boolean, onChange: (visible: boolean) => void): () => void {
  let timer: ReturnType<typeof setTimeout>;
  const reveal = () => {
    onChange(true);
    clearTimeout(timer);
    if (!keepVisible) timer = setTimeout(() => onChange(false), SESSION_CHROME_IDLE_MS);
  };
  const move = () => {
    if (!viewer?.ownerDocument.pointerLockElement) reveal();
  };
  const events = ["pointerdown", "wheel", "keydown", "focusin"] as const;
  for (const event of events) viewer?.addEventListener(event, reveal, { passive: true });
  viewer?.addEventListener("pointermove", move);
  reveal();
  return () => {
    clearTimeout(timer);
    for (const event of events) viewer?.removeEventListener(event, reveal);
    viewer?.removeEventListener("pointermove", move);
  };
}
