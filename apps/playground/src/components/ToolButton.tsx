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
      className={active ? "tool-button active" : "tool-button"}
      onClick={onClick}
      type="button"
    >
      <span>{label}</span>
      <small>{detail}</small>
    </button>
  );
}
