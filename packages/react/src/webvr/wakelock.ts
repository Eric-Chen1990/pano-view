import { useEffect } from "react";

type NavigatorWithWakeLock = Navigator & {
  wakeLock?: {
    request: (type: "screen") => Promise<WakeLockSentinel>;
  };
};

export function useWebVRWakeLock(enabled: boolean): void {
  useEffect(() => {
    if (!enabled || typeof navigator === "undefined") {
      return;
    }
    let active = true;
    let sentinel: WakeLockSentinel | null = null;

    void (navigator as NavigatorWithWakeLock).wakeLock
      ?.request("screen")
      .then((value) => {
        if (!active) {
          void value.release();
          return;
        }
        sentinel = value;
      })
      .catch(() => {
        // Wake lock is best-effort and can be denied by the browser.
      });

    return () => {
      active = false;
      if (sentinel) {
        void sentinel.release();
      }
    };
  }, [enabled]);
}
