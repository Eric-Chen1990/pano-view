import type { PointerEvent as ReactPointerEvent } from "react";
import type { PanoMapSectorDefinition } from "../data/map";

const DEFAULT_SECTOR_COLOR = "#ffffff";
const DEFAULT_SECTOR_OPACITY = 0.55;

export function SectorShape({
  sector,
  angle,
  rotation,
  gradientId,
  interactive,
  onHeadingPointerDown,
  transformRef,
}: {
  sector: PanoMapSectorDefinition;
  angle: number;
  rotation: number;
  gradientId: string;
  interactive?: boolean;
  onHeadingPointerDown?: (event: ReactPointerEvent<SVGPathElement>) => void;
  transformRef?: (node: SVGGElement | null) => void;
}) {
  const half = angle / 2;
  const start = ((-half - 90) * Math.PI) / 180;
  const end = ((half - 90) * Math.PI) / 180;
  const radius = sector.radius;
  const largeArc = angle > 180 ? 1 : 0;
  const x1 = Math.cos(start) * radius;
  const y1 = Math.sin(start) * radius;
  const x2 = Math.cos(end) * radius;
  const y2 = Math.sin(end) * radius;
  const path = `M 0 0 L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`;
  const opacity = sector.opacity ?? DEFAULT_SECTOR_OPACITY;
  const color = sector.color ?? DEFAULT_SECTOR_COLOR;
  const gradient = sector.gradient;
  const strokeWidth = sector.strokeWidth ?? 0;
  const strokeColor = sector.strokeColor ?? color;
  const strokeOpacity = sector.strokeOpacity ?? 1;
  // Stop opacities describe the fade shape (relative). Sector opacity scales the
  // whole fill so the editor slider stays effective in gradient mode.
  const gradientStrength =
    gradient && gradient.stops.length > 0
      ? Math.max(
          ...gradient.stops.map((stop) => stop.opacity ?? 1),
          Number.EPSILON,
        )
      : 1;
  return (
    <g ref={transformRef} transform={`rotate(${rotation})`} style={{ pointerEvents: "none" }}>
      {gradient ? (
        <defs>
          {gradient.type === "radial" ? (
            <radialGradient id={gradientId} cx="0" cy="0" r={radius} gradientUnits="userSpaceOnUse">
              {gradient.stops.map((stop, index) => (
                <stop
                  key={`${stop.offset}:${index}`}
                  offset={`${stop.offset * 100}%`}
                  stopColor={stop.color}
                  stopOpacity={(stop.opacity ?? 1) / gradientStrength}
                />
              ))}
            </radialGradient>
          ) : (
            <linearGradient
              id={gradientId}
              x1="0"
              y1="0"
              x2="0"
              y2={-radius}
              gradientUnits="userSpaceOnUse"
            >
              {gradient.stops.map((stop, index) => (
                <stop
                  key={`${stop.offset}:${index}`}
                  offset={`${stop.offset * 100}%`}
                  stopColor={stop.color}
                  stopOpacity={(stop.opacity ?? 1) / gradientStrength}
                />
              ))}
            </linearGradient>
          )}
        </defs>
      ) : null}
      <path
        d={path}
        fill={gradient ? `url(#${gradientId})` : color}
        fillOpacity={opacity}
        stroke={strokeWidth > 0 ? strokeColor : "none"}
        strokeWidth={strokeWidth > 0 ? strokeWidth : undefined}
        strokeOpacity={strokeWidth > 0 ? strokeOpacity : undefined}
        vectorEffect="non-scaling-stroke"
        style={{
          pointerEvents: interactive ? "auto" : "none",
          cursor: interactive ? "grab" : undefined,
        }}
        onPointerDown={interactive ? onHeadingPointerDown : undefined}
      />
    </g>
  );
}

export function DefaultSpotIcon({ active, size }: { active: boolean; size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      aria-hidden="true"
      style={{ display: "block" }}
    >
      <rect
        x="3"
        y="7"
        width="26"
        height="18"
        rx="5"
        fill={active ? "rgba(15,23,42,0.92)" : "rgba(15,23,42,0.72)"}
        stroke="rgba(255,255,255,0.92)"
        strokeWidth="2"
      />
      <circle cx="16" cy="16" r="5" fill="none" stroke="rgba(255,255,255,0.92)" strokeWidth="2" />
      <circle cx="16" cy="16" r="2" fill={active ? "#ef4444" : "rgba(255,255,255,0.85)"} />
    </svg>
  );
}
