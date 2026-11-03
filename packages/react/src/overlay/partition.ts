import {
  Children,
  Fragment,
  isValidElement,
  type ReactElement,
  type ReactNode,
} from "react";

/** Marks a component as screen-plane UI for PanoViewer child partitioning. */
export const PANO_OVERLAY_TYPE = Symbol.for("pano-view.PanoOverlay");

export function isPanoOverlayType(
  type: unknown,
): type is { [PANO_OVERLAY_TYPE]: true } {
  return (
    typeof type === "function" &&
    (type as { [PANO_OVERLAY_TYPE]?: unknown })[PANO_OVERLAY_TYPE] === true
  );
}

export function isPanoOverlayElement(
  node: ReactNode,
): node is ReactElement<{ children?: ReactNode }> {
  return isValidElement(node) && isPanoOverlayType(node.type);
}

function isFragmentElement(
  node: ReactNode,
): node is ReactElement<{ children?: ReactNode }> {
  return isValidElement(node) && node.type === Fragment;
}

/**
 * Flatten top-level Fragments the same way JSX siblings arrive as children.
 * Children.toArray alone does not expand a single Fragment element.
 */
function flattenViewerChildren(children: ReactNode): ReactNode[] {
  const flat: ReactNode[] = [];
  for (const item of Children.toArray(children)) {
    if (isFragmentElement(item)) {
      flat.push(...flattenViewerChildren(item.props.children));
    } else {
      flat.push(item);
    }
  }
  return flat;
}

/**
 * Split PanoViewer children into the Three.js scene tree and screen-plane overlays.
 * Top-level Fragments are flattened so overlays beside scene nodes are found.
 * Nested overlays inside other components are not detected; those still enter
 * the Canvas and throw at render. When no overlay is present, `sceneChildren`
 * is the original `children` reference so existing scene trees keep their keys
 * and avoid remounting.
 */
export function partitionPanoOverlay(children: ReactNode): {
  sceneChildren: ReactNode;
  overlayElements: ReactElement<{ children?: ReactNode }>[];
} {
  const items = flattenViewerChildren(children);
  const overlayElements: ReactElement<{ children?: ReactNode }>[] = [];
  const sceneItems: ReactNode[] = [];
  let found = false;

  for (const item of items) {
    if (isPanoOverlayElement(item)) {
      found = true;
      overlayElements.push(item);
    } else {
      sceneItems.push(item);
    }
  }

  if (!found) {
    return { sceneChildren: children, overlayElements: [] };
  }

  return { sceneChildren: sceneItems, overlayElements };
}
