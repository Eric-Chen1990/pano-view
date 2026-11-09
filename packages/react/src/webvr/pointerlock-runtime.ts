type LockRequest = { promise: Promise<void>; cancelled: boolean };
const requests = new WeakMap<HTMLElement, LockRequest>();

/** Invoke synchronously before requesting fullscreen, which consumes activation. */
export function requestWebVRPointerLock(element: HTMLElement): Promise<void> {
  const doc = element.ownerDocument;
  if (doc.pointerLockElement === element || typeof element.requestPointerLock !== "function") {
    return Promise.resolve();
  }
  const pending = requests.get(element);
  if (pending) return pending.promise;

  let complete!: () => void;
  const request: LockRequest = {
    promise: new Promise<void>((resolve) => { complete = resolve; }),
    cancelled: false,
  };
  requests.set(element, request);
  let settled = false;
  const finish = () => {
    if (settled) return;
    settled = true;
    doc.removeEventListener("pointerlockchange", onChange);
    doc.removeEventListener("pointerlockerror", finish);
    if (requests.get(element) === request) requests.delete(element);
    if (request.cancelled && doc.pointerLockElement === element) doc.exitPointerLock();
    complete();
  };
  const onChange = () => {
    if (doc.pointerLockElement === element) finish();
  };
  doc.addEventListener("pointerlockchange", onChange);
  doc.addEventListener("pointerlockerror", finish);
  try {
    // Plain movement avoids raw-input permission / support failures during entry.
    const result = element.requestPointerLock() as Promise<void> | undefined;
    result?.then(finish, finish);
  } catch {
    finish();
  }
  return request.promise;
}

export function exitWebVRPointerLock(element: HTMLElement): void {
  const pending = requests.get(element);
  if (pending) pending.cancelled = true;
  const doc = element.ownerDocument;
  if (doc.pointerLockElement === element) doc.exitPointerLock();
}

/** Canvas-only capture keeps relock clicks out of R3F and leaves DOM controls usable. */
export function bindWebVRPointerLock(
  element: HTMLElement,
  onChange: (locked: boolean) => void,
): () => void {
  const doc = element.ownerDocument;
  let suppressLeftClick = false;
  const sync = () => onChange(doc.pointerLockElement === element);
  const consume = (event: Event) => {
    event.preventDefault();
    event.stopImmediatePropagation();
  };
  const down = (event: PointerEvent) => {
    if (event.pointerType !== "mouse") return;
    if (event.button === 2) {
      consume(event);
      exitWebVRPointerLock(element);
    } else if (event.button === 0) {
      suppressLeftClick = doc.pointerLockElement !== element;
      if (suppressLeftClick) {
        consume(event);
        void requestWebVRPointerLock(element);
      }
    }
  };
  const mouse = (event: MouseEvent) => {
    if (event.button === 2 || (event.button === 0 && suppressLeftClick)) consume(event);
    if (event.type === "click") suppressLeftClick = false;
  };
  const context = (event: Event) => consume(event);
  doc.addEventListener("pointerlockchange", sync);
  doc.addEventListener("pointerlockerror", sync);
  element.addEventListener("pointerdown", down, { capture: true });
  element.addEventListener("contextmenu", context, { capture: true });
  const mouseEvents = ["mousedown", "mouseup", "pointerup", "click", "auxclick"] as const;
  for (const type of mouseEvents) element.addEventListener(type, mouse, { capture: true });
  sync();
  return () => {
    doc.removeEventListener("pointerlockchange", sync);
    doc.removeEventListener("pointerlockerror", sync);
    element.removeEventListener("pointerdown", down, { capture: true });
    element.removeEventListener("contextmenu", context, { capture: true });
    for (const type of mouseEvents) element.removeEventListener(type, mouse, { capture: true });
    exitWebVRPointerLock(element);
    onChange(false);
  };
}
