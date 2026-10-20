import { createContext, useContext } from "react";

export type SceneDetailReporter = {
  generation: number;
  report: (ready: boolean) => void;
};

export const SceneDetailContext = createContext<SceneDetailReporter | null>(null);

export function useSceneDetailReporter(): SceneDetailReporter | null {
  return useContext(SceneDetailContext);
}

/** Current-view target tiles are sharp only when every one can already be drawn. */
export function viewTilesAreDrawable(
  textures: readonly (object | null | undefined)[],
): boolean {
  return textures.length > 0 && textures.every((texture) => texture != null);
}

export function publishSceneDetail(
  reporter: SceneDetailReporter | null,
  lastToken: { current: string },
  ready: boolean,
): void {
  if (!reporter) {
    return;
  }
  const token = `${reporter.generation}:${ready ? 1 : 0}`;
  if (lastToken.current === token) {
    return;
  }
  lastToken.current = token;
  reporter.report(ready);
}
