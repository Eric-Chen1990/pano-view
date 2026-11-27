import { Children, Fragment, isValidElement, type ReactNode } from "react";
import { LookDownPanel, useLookDownPanelAvailable } from "./look-down-panel";
import { layoutVRMenu, VR_MENU_WIDTH } from "./menu-layout";

export type WebVRMenuProps = {
  "aria-label": string;
  children: ReactNode;
};

export type WebVRMenuLabelProps = { children: string };

export type WebVRMenuButtonProps = {
  children: string;
  onClick: () => void;
  disabled?: boolean;
  pressed?: boolean;
  "aria-label"?: string;
};

/** A text row inside WebVRMenu. */
export function WebVRMenuLabel(_props: WebVRMenuLabelProps) {
  return null;
}

/** A spatial action inside WebVRMenu. */
export function WebVRMenuButton(_props: WebVRMenuButtonProps) {
  return null;
}

type Item =
  | { kind: "label"; id: string; props: WebVRMenuLabelProps }
  | { kind: "button"; id: string; props: WebVRMenuButtonProps };

function readItems(children: ReactNode): Item[] {
  const items: Item[] = [];
  const visit = (nodes: ReactNode, parent: string) => {
    for (const child of Children.toArray(nodes)) {
      if (!isValidElement(child)) continue;
      const id = `${parent}/${child.key}`;
      if (child.type === Fragment) {
        visit((child.props as { children: ReactNode }).children, id);
      } else if (child.type === WebVRMenuLabel) {
        items.push({ kind: "label", id, props: child.props as WebVRMenuLabelProps });
      } else if (child.type === WebVRMenuButton) {
        items.push({ kind: "button", id, props: child.props as WebVRMenuButtonProps });
      }
    }
  };
  visit(children, "");
  return items;
}

/** Mount alongside WebVR inside PanoViewer. */
export function WebVRMenu({ children, "aria-label": label }: WebVRMenuProps) {
  const available = useLookDownPanelAvailable();
  return available ? <MenuContent label={label}>{children}</MenuContent> : null;
}

function MenuContent({ children, label }: { children: ReactNode; label: string }) {
  const items = readItems(children);
  if (!items.length) return null;
  const { entries, height } = layoutVRMenu(items);
  const paintKey = JSON.stringify(items.map((item) => item.kind === "button"
    ? [item.id, item.props.children, item.props.pressed, item.props.disabled]
    : [item.id, item.props.children]));
  return (
    <LookDownPanel
      width={VR_MENU_WIDTH}
      height={height}
      label={label}
      kind="menu"
      paintKey={paintKey}
      paint={(ctx, focused) => {
        ctx.fillStyle = "rgba(9, 17, 25, 0.92)";
        ctx.beginPath();
        ctx.roundRect(0, 0, VR_MENU_WIDTH, height, 22);
        ctx.fill();
        ctx.textBaseline = "middle";
        for (const { kind, id, props, x, y, width, height } of entries) {
          if (kind === "label") {
            ctx.fillStyle = "#ffffff";
            ctx.font = "600 31px system-ui, sans-serif";
            ctx.textAlign = "left";
            ctx.fillText(props.children, x, y + height / 2, width);
            continue;
          }
          const active = focused === id && !props.disabled;
          ctx.fillStyle = active ? "#7dd3fc" : props.pressed ? "#315063" : "#243240";
          ctx.beginPath();
          ctx.roundRect(x, y, width, height, 12);
          ctx.fill();
          ctx.fillStyle = props.disabled ? "#8c9cab" : active ? "#091119" : "#ffffff";
          ctx.font = "600 34px system-ui, sans-serif";
          ctx.textAlign = "center";
          ctx.fillText(props.children, x + width / 2, y + height / 2, width - 20);
        }
      }}
      resolveAction={(x, y) => {
        const target = entries.find((entry) =>
          entry.kind === "button" && !entry.props.disabled &&
          x >= entry.x && x <= entry.x + entry.width &&
          y >= entry.y && y <= entry.y + entry.height,
        );
        if (target?.kind === "button") return { id: target.id, activate: target.props.onClick };
      }}
      accessibility={items.map(({ kind, id, props }) => kind === "label" ? (
        <span key={id} className="pano-sr-only">{props.children}</span>
      ) : (
        <button key={id} type="button" className="pano-sr-only"
          aria-label={props["aria-label"]} aria-pressed={props.pressed}
          disabled={props.disabled} data-pano-vr-action={id} onClick={props.onClick}
        >
          {props.children}
        </button>
      ))}
    />
  );
}
