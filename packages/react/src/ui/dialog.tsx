import * as DialogPrimitive from "@radix-ui/react-dialog";
import { forwardRef, useId, useRef, useState, type ComponentPropsWithoutRef, type CSSProperties, type ReactNode } from "react";
import { PanoOverlayPortalProvider, usePanoModal, usePanoOverlay } from "../overlay/pano-overlay";

export type PanoDialogRootProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
};

export function PanoDialogRoot({ open, onOpenChange, children }: PanoDialogRootProps) {
  usePanoModal(open);
  return <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>{children}</DialogPrimitive.Root>;
}

export type PanoDialogBackdropProps = Omit<ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>, "forceMount">;

export const PanoDialogBackdrop = forwardRef<HTMLDivElement, PanoDialogBackdropProps>(
  function PanoDialogBackdrop({ style, className, ...props }, ref) {
    const { portalContainer } = usePanoOverlay();
    if (!portalContainer) return null;
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
    const { portalContainer, visibleRect } = usePanoOverlay();
    const [nestedContainer, setNestedContainer] = useState<HTMLDivElement | null>(null);
    const returnFocus = useRef<HTMLElement | null>(null);
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
    };
    return (
      <DialogPrimitive.Portal container={portalContainer}>
        <DialogPrimitive.Content
          {...props}
          ref={forwardedRef}
          data-pano-dialog=""
          className={["pano-dialog-content", className].filter(Boolean).join(" ")}
          style={layout}
          onOpenAutoFocus={(event) => {
            const active = portalContainer.ownerDocument.activeElement;
            returnFocus.current = active instanceof HTMLElement ? active : null;
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
export function PanoDialog({ open, onOpenChange, title, description, closeLabel = "Close", children, className, style }: PanoDialogProps) {
  const descriptionId = useId();
  return (
    <PanoDialogRoot open={open} onOpenChange={onOpenChange}>
      <PanoDialogBackdrop />
      <PanoDialogContent
        className={className}
        style={{ overflow: "hidden", ...style }}
        aria-describedby={description == null ? undefined : descriptionId}
      >
        <header className="pano-dialog-header" style={{ display: "flex", alignItems: "start", justifyContent: "space-between", gap: 16, flexShrink: 0 }}>
          <div>
            <PanoDialogTitle className="pano-dialog-title">{title}</PanoDialogTitle>
            {description == null ? null : (
              <PanoDialogDescription id={descriptionId} className="pano-dialog-description">{description}</PanoDialogDescription>
            )}
          </div>
          <PanoDialogClose className="pano-dialog-close" aria-label={closeLabel} type="button">×</PanoDialogClose>
        </header>
        <div className="pano-dialog-body" style={{ overflow: "auto", minHeight: 0 }}>{children}</div>
      </PanoDialogContent>
    </PanoDialogRoot>
  );
}
