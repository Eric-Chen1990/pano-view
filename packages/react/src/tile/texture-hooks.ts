import type { RootState } from "@react-three/fiber";
import { useEffect, useState } from "react";
import type { Texture } from "three";
import { getTextureAnisotropy } from "../renderer-capabilities";
import type { TextureEntrySnapshot } from "./types";
import { configureMipmappedTexture, type TileTextureManager } from "./texture-manager";

export function configureTilePreviewTexture(texture: Texture, gl: RootState["gl"]) {
  configureMipmappedTexture(texture, getTextureAnisotropy(gl));
}

export function useManagedTexture<
  TAddress extends { width: number; height: number },
>(
  manager: Pick<TileTextureManager<TAddress>, "acquire" | "getSnapshot">,
  key: string,
  url: string,
  address: TAddress,
): TextureEntrySnapshot {
  const [managedState, setManagedState] = useState(() => ({
    manager,
    key,
    url,
    snapshot: manager.getSnapshot(key),
  }));

  const snapshot =
    managedState.manager === manager &&
    managedState.key === key &&
    managedState.url === url
      ? managedState.snapshot
      : manager.getSnapshot(key);

  useEffect(
    () =>
      manager.acquire(key, url, address, (nextSnapshot) => {
        setManagedState({
          manager,
          key,
          url,
          snapshot: nextSnapshot,
        });
      }),
    [key, manager, url],
  );

  return snapshot;
}
