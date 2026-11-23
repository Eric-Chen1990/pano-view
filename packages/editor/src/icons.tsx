import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

function icon(props: IconProps) {
  return {
    width: 14,
    height: 14,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.5,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true as const,
    ...props,
  };
}

export function IconPlus(props: IconProps) {
  return (
    <svg {...icon(props)}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function IconEdit(props: IconProps) {
  return (
    <svg {...icon(props)}>
      <path d="m16 3 5 5-12 12-6 1 1-6Z" />
      <path d="m13 6 5 5" />
    </svg>
  );
}

export function IconTrash(props: IconProps) {
  return (
    <svg {...icon(props)}>
      <path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7" />
    </svg>
  );
}

export function IconDuplicate(props: IconProps) {
  return (
    <svg {...icon(props)}>
      <rect x="9" y="9" width="12" height="12" rx="1.5" />
      <path d="M5 15V5a2 2 0 0 1 2-2h10" />
    </svg>
  );
}

export function IconUndo(props: IconProps) {
  return (
    <svg {...icon(props)}>
      <path d="M9 14 4 9l5-5" />
      <path d="M4 9h10a6 6 0 0 1 0 12h-3" />
    </svg>
  );
}

export function IconRedo(props: IconProps) {
  return (
    <svg {...icon(props)}>
      <path d="m15 14 5-5-5-5" />
      <path d="M20 9H10a6 6 0 0 0 0 12h3" />
    </svg>
  );
}

export function IconEye(props: IconProps) {
  return (
    <svg {...icon(props)}>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export function IconFullscreen(props: IconProps) {
  return (
    <svg {...icon(props)}>
      <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
    </svg>
  );
}

export function IconDownload(props: IconProps) {
  return (
    <svg {...icon(props)}>
      <path d="M12 3v12M7 10l5 5 5-5M5 21h14" />
    </svg>
  );
}

export function IconMore(props: IconProps) {
  return (
    <svg {...icon({ ...props, fill: "currentColor", stroke: "none" })}>
      <circle cx="5" cy="12" r="1.75" />
      <circle cx="12" cy="12" r="1.75" />
      <circle cx="19" cy="12" r="1.75" />
    </svg>
  );
}

export function IconBack(props: IconProps) {
  return (
    <svg {...icon(props)}>
      <path d="m14 5-7 7 7 7" />
    </svg>
  );
}

export function IconDrag(props: IconProps) {
  return (
    <svg
      width={14}
      height={16}
      viewBox="0 0 14 16"
      fill="currentColor"
      aria-hidden="true"
      {...props}
    >
      {[4, 8, 12].map((y) => (
        <g key={y}>
          <circle cx="4" cy={y} r="1" />
          <circle cx="10" cy={y} r="1" />
        </g>
      ))}
    </svg>
  );
}

export function IconChevron(props: IconProps) {
  return (
    <svg
      width={12}
      height={12}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden="true"
      {...props}
    >
      <path d="m6 3 5 5-5 5" />
    </svg>
  );
}

export function IconScenes(props: IconProps) {
  return (
    <svg {...icon({ ...props, width: 16, height: 16 })}>
      <rect x="3" y="4" width="18" height="14" rx="2" />
      <path d="M3 9h18" />
    </svg>
  );
}

export function IconPopups(props: IconProps) {
  return (
    <svg {...icon({ ...props, width: 16, height: 16 })}>
      <path d="M5 5h14v10H9l-4 3V5Z" />
    </svg>
  );
}

export function IconMap(props: IconProps) {
  return (
    <svg {...icon({ ...props, width: 16, height: 16 })}>
      <path d="m3 6 6-2 6 2 6-2v14l-6 2-6-2-6 2V6Z" />
      <path d="M9 4v14M15 6v14" />
    </svg>
  );
}

export function IconUp(props: IconProps) {
  return (
    <svg {...icon(props)}>
      <path d="m6 14 6-6 6 6" />
    </svg>
  );
}

export function IconDown(props: IconProps) {
  return (
    <svg {...icon(props)}>
      <path d="m6 10 6 6 6-6" />
    </svg>
  );
}

export function IconPlay(props: IconProps) {
  return (
    <svg {...icon({ ...props, fill: "currentColor", stroke: "none" })}>
      <path d="M8 5v14l11-7Z" />
    </svg>
  );
}
