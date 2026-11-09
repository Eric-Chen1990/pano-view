import { useRef, useState, type ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { PanoOverlayPortalProvider, usePanoDialogSurface } from "@ericchen1990/pano-view";

const closeButtonClassName =
  "inline-flex min-h-9 items-center justify-center border border-[#3e6c73] bg-transparent px-3 py-2 text-[0.72rem] font-medium text-[#f5fbfc] transition hover:border-[#75cbd3]";

// Render inside PanoOverlay. Mount the third-party Portal only after portalContainer exists.
export function ThirdPartyDialog({
  open,
  onOpenChange,
  title,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: ReactNode;
}) {
  const { portalContainer, visibleRect, contentRef, presentation } = usePanoDialogSurface({ open, onOpenChange });
  const [nestedContainer, setNestedContainer] = useState<HTMLDivElement | null>(null);
  const restoreFocus = useRef<HTMLElement | null>(null);

  return (
    <Dialog.Root modal={false} open={open} onOpenChange={onOpenChange}>
      {portalContainer ? (
        <Dialog.Portal container={portalContainer}>
          {presentation === "screen" ? <Dialog.Overlay className="absolute inset-0 bg-black/70" style={{ pointerEvents: "auto" }} /> : null}
          <Dialog.Content
            ref={contentRef}
            onInteractOutside={event => { if (presentation === "spatial") event.preventDefault(); }}
            aria-describedby={undefined}
            className="absolute top-1/2 left-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden border-2 border-cyan-300 bg-slate-950 text-slate-100"
            style={{
              left: presentation === "spatial" ? -10000 : visibleRect.left + visibleRect.width / 2,
              top: presentation === "spatial" ? 0 : visibleRect.top + visibleRect.height / 2,
              width: Math.min(720, Math.max(0, visibleRect.width - 32)),
              maxHeight: Math.max(0, visibleRect.height - 32),
              pointerEvents: "auto",
              ...(presentation === "spatial" ? { transform: "none" } : {}),
            }}
            onOpenAutoFocus={(event) => {
              if (presentation === "spatial") event.preventDefault();
              restoreFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
            }}
            onCloseAutoFocus={(event) => {
              event.preventDefault();
              const target = restoreFocus.current?.isConnected
                ? restoreFocus.current
                : portalContainer.closest("[data-pano-viewer]")?.querySelector("canvas");
              target?.focus({ preventScroll: true });
            }}
          >
            <header className="flex shrink-0 items-center justify-between gap-4 border-b border-cyan-300 p-4">
              <Dialog.Title className="m-0 text-lg">{title}</Dialog.Title>
              <Dialog.Close className={closeButtonClassName}>Close</Dialog.Close>
            </header>
            <PanoOverlayPortalProvider container={nestedContainer}>
              <div className="min-h-0 overflow-auto p-4">{children}</div>
            </PanoOverlayPortalProvider>
            <div ref={setNestedContainer} data-custom-dialog-portals="" className="pointer-events-none absolute inset-0 z-10" />
          </Dialog.Content>
        </Dialog.Portal>
      ) : null}
    </Dialog.Root>
  );
}
