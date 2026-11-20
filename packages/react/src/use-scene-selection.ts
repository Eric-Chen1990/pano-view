import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { cycleSceneId } from "./keyboard-controls";
import { notifyScenesHost, ScenesHostContext, type ScenesController } from "./scenes-host";

export function useSceneSelection({
  scenes, controlledId, defaultActiveSceneId, onActiveSceneIdChange, isTransitioning, fallbackToFirst = false,
}: {
  scenes: readonly { id: string }[];
  controlledId?: string;
  defaultActiveSceneId?: string;
  onActiveSceneIdChange?: (id: string) => void;
  isTransitioning: () => boolean;
  fallbackToFirst?: boolean;
}) {
  const host = useContext(ScenesHostContext);
  const isControlled = controlledId !== undefined;
  const [internalId, setInternalId] = useState(
    () => {
      const recovery = host?.recovery;
      const previousId = recovery?.project === null && scenes.some((scene) => scene.id === recovery.id)
        ? recovery.id
        : undefined;
      return controlledId ?? previousId ?? defaultActiveSceneId ?? scenes[0]?.id ?? "";
    },
  );

  const resolvedId = isControlled ? controlledId
    : fallbackToFirst && !scenes.some((scene) => scene.id === internalId)
      ? scenes[0]?.id ?? ""
      : internalId;

  const requestSceneChange = useCallback(
    (id: string) => {
      if (isControlled) {
        onActiveSceneIdChange?.(id);
      } else {
        setInternalId(id);
      }
    },
    [isControlled, onActiveSceneIdChange],
  );

  const scenesRef = useRef(scenes);
  scenesRef.current = scenes;
  const resolvedIdRef = useRef(resolvedId);
  resolvedIdRef.current = resolvedId;

  useEffect(() => {
    if (!host) {
      return;
    }

    const controller: ScenesController = {
      setScene: (id) => {
        const match = scenesRef.current.find((s) => s.id === id);
        if (!match) {
          return false;
        }
        requestSceneChange(id);
        return true;
      },
      nextScene: () => {
        const next = cycleSceneId(
          scenesRef.current,
          resolvedIdRef.current,
          1,
        );
        if (next === null) {
          return false;
        }
        requestSceneChange(next);
        return true;
      },
      previousScene: () => {
        const next = cycleSceneId(
          scenesRef.current,
          resolvedIdRef.current,
          -1,
        );
        if (next === null) {
          return false;
        }
        requestSceneChange(next);
        return true;
      },
      getActiveSceneId: () => resolvedIdRef.current,
      getSceneIds: () => scenesRef.current.map((s) => s.id),
      isTransitioning,
    };

    host.controller = controller;
    notifyScenesHost(host);
    return () => {
      if (host.controller === controller) {
        host.controller = null;
        notifyScenesHost(host);
      }
    };
  }, [host, isTransitioning, requestSceneChange]);

  return { resolvedId, requestSceneChange };
}
