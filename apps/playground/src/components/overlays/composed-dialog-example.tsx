import { useRef, type ReactNode } from "react";
import { PanoScrollControls } from "@ericchen1990/pano-view";
import {
  PanoDialogBackdrop,
  PanoDialogClose,
  PanoDialogContent,
  PanoDialogDescription,
  PanoDialogRoot,
  PanoDialogTitle,
} from "@ericchen1990/pano-view/ui";

const closeButtonClassName =
  "inline-flex min-h-9 items-center justify-center border border-[#3e6c73] bg-transparent px-3 py-2 text-[0.72rem] font-medium text-[#f5fbfc] transition hover:border-[#75cbd3]";

// Render inside PanoOverlay. Root already takes the viewer modal lock.
export function ComposedHotspotDialog({
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
  const scrollRef = useRef<HTMLDivElement>(null);
  return (
    <PanoDialogRoot open={open} onOpenChange={onOpenChange}>
      <PanoDialogBackdrop style={{ background: "rgb(8 25 29 / 85%)" }} />
      <PanoDialogContent style={{ borderRadius: 0, border: "2px solid #df6b42", overflow: "hidden" }}>
        <header className="flex shrink-0 items-center justify-between gap-4 border-b border-orange-400 p-4">
          <div>
            <PanoDialogTitle className="m-0 text-xl">{title}</PanoDialogTitle>
            <PanoDialogDescription className="m-0 text-sm text-slate-300">
              A custom header built from dialog parts.
            </PanoDialogDescription>
          </div>
          <PanoDialogClose className={closeButtonClassName}>Close</PanoDialogClose>
        </header>
        <div ref={scrollRef} className="min-h-0 overflow-auto p-4">{children}</div>
        <PanoScrollControls targetRef={scrollRef} />
      </PanoDialogContent>
    </PanoDialogRoot>
  );
}
