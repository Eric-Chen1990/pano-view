import { createContext, useContext } from "react";

export type ControlChannel = "mouse" | "touch" | "keyboard";

export type ControlClaims = Record<ControlChannel, number>;

export const ControlClaimsContext = createContext<ControlClaims | null>(null);

export const DefaultControlChannelContext = createContext(false);

const CHANNEL_COMPONENT: Record<ControlChannel, string> = {
  mouse: "MouseControls",
  touch: "TouchControls",
  keyboard: "KeyboardControls",
};

export function createControlClaims(): ControlClaims {
  return { mouse: 0, touch: 0, keyboard: 0 };
}

export function resetControlClaims(claims: ControlClaims): void {
  claims.mouse = 0;
  claims.touch = 0;
  claims.keyboard = 0;
}

function isProduction(): boolean {
  const nodeEnv = (
    globalThis as typeof globalThis & {
      process?: { env?: { NODE_ENV?: string } };
    }
  ).process?.env?.NODE_ENV;
  return nodeEnv === "production";
}

/** Registers a user control instance during render so default slots can skip. */
export function useClaimControlChannel(channel: ControlChannel): void {
  const claims = useContext(ControlClaimsContext);
  const isDefault = useContext(DefaultControlChannelContext);
  if (!claims || isDefault) {
    return;
  }
  claims[channel] += 1;
  if (!isProduction() && claims[channel] > 1) {
    const name = CHANNEL_COMPONENT[channel];
    console.warn(
      `PanoViewer: multiple <${name}> instances are mounted. Render at most one per channel.`,
    );
  }
}
