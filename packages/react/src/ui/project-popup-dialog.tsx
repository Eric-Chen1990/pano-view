import { useEffect, useRef } from "react";
import type { ProjectPopupBlock, ProjectPopupDefinition } from "../data";
import { PanoDialog } from "./dialog";

export type ProjectPopupDialogProps = {
  popup: ProjectPopupDefinition | null;
  onOpenChange: (open: boolean) => void;
  closeLabel?: string;
  onMediaError?: (block: ProjectPopupBlock) => void;
};

function PopupMedia({ block, label, onError }: {
  block: Extract<ProjectPopupBlock, { type: "audio" | "video" }>;
  label: string;
  onError?: () => void;
}) {
  const ref = useRef<HTMLMediaElement | null>(null);
  useEffect(() => {
    const media = ref.current;
    // Strict Mode replays cleanup/setup on the same DOM node.
    if (media && media.getAttribute("src") !== block.src) {
      media.src = block.src;
      media.load();
    }
    return () => {
      if (!media) return;
      media.pause();
      media.removeAttribute("src");
      media.load();
    };
  }, [block.src]);
  const props = { controls: true, autoPlay: false, preload: "metadata", src: block.src, onError } as const;
  return block.type === "video"
    ? <video {...props} ref={(node) => { ref.current = node; }} playsInline poster={block.poster} aria-label={label} />
    : <audio {...props} ref={(node) => { ref.current = node; }} aria-label={label} />;
}

/** Render in PanoViewer.renderOverlay; the host owns selection and may replace this UI. */
export function ProjectPopupDialog({ popup, onOpenChange, closeLabel, onMediaError }: ProjectPopupDialogProps) {
  return <PanoDialog open={popup !== null} onOpenChange={onOpenChange} title={popup?.title || popup?.id || ""} closeLabel={closeLabel}>
    {popup ? <div className="pano-project-popup" key={popup.id}>
      {popup.blocks.map((block) => block.type === "text"
        ? <p key={block.id} style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{block.text}</p>
        : block.type === "image"
          ? <img key={`${block.id}:${block.src}`} src={block.src} alt={block.alt ?? ""} onError={() => onMediaError?.(block)} />
          : <PopupMedia key={`${block.id}:${block.src}`} block={block} label={popup.title} onError={() => onMediaError?.(block)} />)}
    </div> : null}
  </PanoDialog>;
}
