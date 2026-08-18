import type { SceneTransitionPreset } from "@ericchen1990/pano-view";
import { Fragment, useEffect, useId, useMemo, useRef, useState } from "react";
import { cn } from "../../cn";
import { TRANSITION_PRESET_GROUPS } from "../../constants";
import { controlInputClassName } from "../../ui";

type BlendSelectProps = {
  value: SceneTransitionPreset;
  onChange: (value: SceneTransitionPreset) => void;
};

export function BlendSelect({ value, onChange }: BlendSelectProps) {
  const listboxId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  const options = useMemo(
    () => TRANSITION_PRESET_GROUPS.flatMap((group) => group.presets),
    [],
  );
  const selected = options.find((entry) => entry.value === value) ?? options[0];

  useEffect(() => {
    if (!open) {
      return;
    }

    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div className="relative min-w-[12.5rem]" ref={rootRef}>
      <button
        aria-controls={listboxId}
        aria-expanded={open}
        aria-haspopup="listbox"
        className={cn(controlInputClassName, "flex w-full items-center justify-between gap-3 text-left")}
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        <span>{selected?.label}</span>
        <span aria-hidden className="text-[0.65rem] text-[#88a6ac]">
          {open ? "▴" : "▾"}
        </span>
      </button>
      {open ? (
        <div
          className="absolute top-[calc(100%+6px)] left-0 z-20 max-h-[min(26rem,70vh)] min-w-full overflow-y-auto border border-[#3e6c73] bg-[#08191d] py-1.5 shadow-[0_18px_40px_rgb(0_0_0_/_0.45)]"
          id={listboxId}
          role="listbox"
        >
          {TRANSITION_PRESET_GROUPS.map((group, index) => (
            <Fragment key={group.label ?? "ungrouped"}>
              {index > 0 ? (
                <div className="mx-2.5 my-1.5 h-px bg-[#3e6c73]" role="separator" />
              ) : null}
              {group.label ? (
                <div className="px-3 pt-1.5 pb-1 font-mono text-[0.68rem] font-semibold tracking-[0.1em] text-[#75cbd3] uppercase">
                  {group.label}
                </div>
              ) : null}
              {group.presets.map((entry) => {
                const isSelected = entry.value === value;
                return (
                  <button
                    aria-selected={isSelected}
                    className={cn(
                      "flex w-full items-center gap-2 px-3 py-1.5 text-left text-[0.78rem] text-[#e7f2f5] transition hover:bg-[#16343b]",
                      isSelected && "bg-[#102b31] text-white",
                    )}
                    key={entry.value}
                    onClick={() => {
                      onChange(entry.value);
                      setOpen(false);
                    }}
                    role="option"
                    type="button"
                  >
                    <span aria-hidden className="w-3.5 text-[#df6b42]">
                      {isSelected ? "✓" : ""}
                    </span>
                    {entry.label}
                  </button>
                );
              })}
            </Fragment>
          ))}
        </div>
      ) : null}
    </div>
  );
}
