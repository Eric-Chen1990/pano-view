import type { ComponentPropsWithoutRef } from "react";

/**
 * Public props for the PanoView container.
 *
 * The initial implementation deliberately behaves like an unstyled div. Its
 * stable export gives future panoramic-rendering features a clear home without
 * imposing layout or visual decisions on consuming applications.
 */
export type PanoViewProps = ComponentPropsWithoutRef<"div">;

/**
 * Placeholder root component for future panoramic viewing capabilities.
 */
export function PanoView({ children, ...props }: PanoViewProps) {
  return <div {...props}>{children}</div>;
}
