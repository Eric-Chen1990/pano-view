import * as DialogPrimitive from "@radix-ui/react-dialog";
import { useCallback, useContext, forwardRef, useId, useRef, useState, type ComponentPropsWithoutRef, type CSSProperties, type ReactNode, type RefObject } from "react";
import { PanoOverlayPortalProvider, PanoDialogSurfaceContext as SurfaceContext, usePanoDialogSurface, usePanoOverlay } from "../overlay/pano-overlay";

export type PanoDialogRootProps = {
  scrollTargetRef?: RefObject<HTMLElement | null>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
};

export function PanoDialogRoot({ open, onOpenChange, children, scrollTargetRef }: PanoDialogRootProps) {
  const surface = usePanoDialogSurface({ open, onOpenChange, scrollTargetRef });
  // Keep modality inside the viewer overlay. Radix modal mode would lock page
  // scroll and disable the host document; viewer input is already gated by usePanoModal.
  return (
    <DialogPrimitive.Root modal={false} open={open} onOpenChange={onOpenChange}>
      <SurfaceContext.Provider value={surface}>{children}</SurfaceContext.Provider>
    </DialogPrimitive.Root>
  );
}

export type PanoDialogBackdropProps = Omit<ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>, "forceMount">;

export const PanoDialogBackdrop = forwardRef<HTMLDivElement, PanoDialogBackdropProps>(
  function PanoDialogBackdrop({ style, className, ...props }, ref) {
    const { portalContainer } = usePanoOverlay();
    const surface = useContext(SurfaceContext);
    if (!portalContainer || surface?.presentation === "spatial") return null;
    return (
      <DialogPrimitive.Portal container={portalContainer}>
        <DialogPrimitive.Overlay
          {...props}
          ref={ref}
          data-pano-dialog-backdrop=""
          className={["pano-dialog-backdrop", className].filter(Boolean).join(" ")}
          style={{ position: "absolute", inset: 0, pointerEvents: "auto", ...style }}
        />
      </DialogPrimitive.Portal>
    );
  },
);

export type PanoDialogContentProps = Omit<ComponentPropsWithoutRef<typeof DialogPrimitive.Content>, "forceMount" | "asChild">;

export const PanoDialogContent = forwardRef<HTMLDivElement, PanoDialogContentProps>(
  function PanoDialogContent({ children, style, className, onOpenAutoFocus, onCloseAutoFocus, ...props }, forwardedRef) {
    const overlay = usePanoOverlay();
    const surface = useContext(SurfaceContext);
    const { portalContainer, visibleRect } = surface ?? overlay;
    const [nestedContainer, setNestedContainer] = useState<HTMLDivElement | null>(null);
    const returnFocus = useRef<HTMLElement | null>(null);
    const contentRef = useCallback((node: HTMLDivElement | null) => { surface?.contentRef(node); if (typeof forwardedRef === "function") forwardedRef(node); else if (forwardedRef) forwardedRef.current = node; }, [surface?.contentRef, forwardedRef]);
    if (!portalContainer) return null;
    const layout: CSSProperties & Record<`--pano-dialog-${string}`, string> = {
      "--pano-dialog-available-width": `${Math.max(0, visibleRect.width - 32)}px`,
      "--pano-dialog-available-height": `${Math.max(0, visibleRect.height - 32)}px`,
      position: "absolute",
      top: visibleRect.top + visibleRect.height / 2,
      left: visibleRect.left + visibleRect.width / 2,
      transform: "translate(-50%, -50%)",
      width: "min(var(--pano-dialog-width, 640px), var(--pano-dialog-available-width))",
      maxHeight: "var(--pano-dialog-available-height)",
      boxSizing: "border-box",
      display: "flex",
      flexDirection: "column",
      overflow: "auto",
      pointerEvents: "auto",
      zIndex: 1,
      ...style,
      ...(surface?.presentation === "spatial" ? { left: -10000, top: 0, transform: "none", width: 640, maxHeight: 688 } : {}),
    };
    return (
      <DialogPrimitive.Portal container={portalContainer}>
        <DialogPrimitive.Content
          {...props}
          ref={contentRef}
          data-pano-dialog=""
          className={["pano-dialog-content", className].filter(Boolean).join(" ")}
          style={layout}
          onInteractOutside={(event) => { if (surface?.presentation === "spatial") event.preventDefault(); props.onInteractOutside?.(event); }}
          onOpenAutoFocus={(event) => {
            const active = portalContainer.ownerDocument.activeElement;
            returnFocus.current = active instanceof HTMLElement ? active : null;
            if (surface?.presentation === "spatial") event.preventDefault();
            onOpenAutoFocus?.(event);
          }}
          onCloseAutoFocus={(event) => {
            onCloseAutoFocus?.(event);
            if (event.defaultPrevented) return;
            event.preventDefault();
            const previous = returnFocus.current;
            const canvas = portalContainer.closest("[data-pano-viewer]")?.querySelector("canvas");
            const target = previous?.isConnected && previous !== previous.ownerDocument.body && !previous.closest("[inert]")
              ? previous : canvas;
            if (target && !target.closest("[inert]")) target.focus({ preventScroll: true });
          }}
        >
          <PanoOverlayPortalProvider container={nestedContainer}>
            {children}
          </PanoOverlayPortalProvider>
          <div
            data-pano-dialog-portals=""
            ref={setNestedContainer}
            style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 2 }}
          />
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    );
  },
);

export const PanoDialogTitle = DialogPrimitive.Title;
export const PanoDialogDescription = DialogPrimitive.Description;
export const PanoDialogClose = DialogPrimitive.Close;
export type PanoDialogTitleProps = ComponentPropsWithoutRef<typeof PanoDialogTitle>;
export type PanoDialogDescriptionProps = ComponentPropsWithoutRef<typeof PanoDialogDescription>;
export type PanoDialogCloseProps = ComponentPropsWithoutRef<typeof PanoDialogClose>;

export type PanoDialogProps = PanoDialogRootProps & {
  title: ReactNode;
  description?: ReactNode;
  closeLabel?: string;
  className?: string;
  style?: CSSProperties;
};

/** A ready-to-use modal; compose the exported parts for a different layout. */
export function PanoDialog({ open, onOpenChange, title, description, closeLabel = "Close", children, className, style, scrollTargetRef }: PanoDialogProps) {
  const descriptionId = useId();
  return (
    <PanoDialogRoot open={open} onOpenChange={onOpenChange} scrollTargetRef={scrollTargetRef}>
      <PanoDialogBackdrop />
      <PanoDialogContent
        className={className}
        style={{ overflow: "hidden", ...style }}
        aria-describedby={description == null ? undefined : descriptionId}
      >
        <header className="pano-dialog-header" style={{ flexShrink: 0 }}>
          <div>
            <PanoDialogTitle className="pano-dialog-title">{title}</PanoDialogTitle>
            {description == null ? null : (
              <PanoDialogDescription id={descriptionId} className="pano-dialog-description">{description}</PanoDialogDescription>
            )}
          </div>
        </header>
        <PanoDialogClose className="pano-dialog-close" aria-label={closeLabel} type="button">
          <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="m4 4 8 8M12 4l-8 8" />
          </svg>
        </PanoDialogClose>
        <div data-pano-scroll-viewport="" className="pano-dialog-body" style={{ overflow: "auto", minHeight: 0 }}>{children}</div>
      </PanoDialogContent>
    </PanoDialogRoot>
  );
}
