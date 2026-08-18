import { cn } from "../cn";
import { toolButtonActiveClassName, toolButtonClassName } from "../ui";

export function ToolButton({
  active,
  label,
  detail,
  onClick,
}: {
  active: boolean;
  label: string;
  detail: string;
  onClick: () => void;
}) {
  return (
    <button
      className={cn(toolButtonClassName, active && toolButtonActiveClassName)}
      onClick={onClick}
      type="button"
    >
      <span className={cn("text-[0.75rem] font-semibold text-[#dbeef0]", active && "text-white")}>
        {label}
      </span>
      <small className="font-mono text-[0.6rem] uppercase tracking-[0.08em] text-[#739097]">
        {detail}
      </small>
    </button>
  );
}
