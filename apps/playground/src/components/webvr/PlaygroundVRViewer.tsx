import { useMemo, useState, useSyncExternalStore } from "react";
import {
  PanoEvents,
  PanoViewer,
  type PanoContextMenuActionItem,
  type PanoContextMenuProps,
  type PanoViewerProps,
  type UsePanoViewerResult,
} from "@ericchen1990/pano-view";
import { usePlaygroundLanguage } from "../../i18n/language";

type PlaygroundVRViewerProps = Omit<PanoViewerProps, "contextMenu"> & {
  viewer: UsePanoViewerResult;
  contextMenu?: PanoContextMenuProps;
  vrMenuEnabled?: boolean;
};

export function PlaygroundVRViewer({
  children,
  contextMenu,
  renderOverlay,
  viewer,
  vrMenuEnabled = true,
  ...props
}: PlaygroundVRViewerProps) {
  const { t } = usePlaygroundLanguage();
  const available = useSyncExternalStore(
    viewer.subscribeVR,
    () => viewer.isVRAvailable(),
    () => false,
  );
  const [denial, setDenial] = useState<string | null>(null);
  const menu = useMemo(() => {
    if (!available || !vrMenuEnabled) return contextMenu;
    const entry: PanoContextMenuActionItem = {
      id: "enter-vr",
      label: t("Enter VR"),
      onSelect: () => {
        setDenial(null);
        void viewer.enterVR();
      },
    };
    return contextMenu?.items
      ? { ...contextMenu, items: [...contextMenu.items, entry] }
      : { ...contextMenu, append: [...(contextMenu?.append ?? []), entry] };
  }, [available, contextMenu, t, viewer, vrMenuEnabled]);

  return (
    <PanoViewer
      {...props}
      ref={viewer.ref}
      contextMenu={menu}
      renderOverlay={(overlay) => (
        <>
          {renderOverlay?.(overlay)}
          {denial !== null ? (
            <p
              className="absolute inset-x-3 top-3 mx-auto w-fit max-w-[calc(100%-1.5rem)] rounded-md bg-[#08191d]/95 px-3 py-2 text-sm text-ink"
              role="alert"
            >
              {t("VR denied: {reason}", { reason: t(denial) })}
            </p>
          ) : null}
        </>
      )}
    >
      <PanoEvents
        onVRDenied={(error) => setDenial(
          error instanceof Error ? error.message : "VR permission was denied",
        )}
        onVREnter={() => setDenial(null)}
      />
      {children}
    </PanoViewer>
  );
}
