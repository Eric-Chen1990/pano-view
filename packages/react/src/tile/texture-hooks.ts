import { useEffect, useRef, useState } from "react";
import { Texture, TextureLoader } from "three";
import type { TextureEntrySnapshot } from "./types";
import {
  configureMipmappedTexture,
  type TileTextureManager,
} from "./texture-manager";

export function usePreviewTexture(
  url: string | null,
  anisotropy: number,
  onError?: (error: unknown) => void,
) {
  const [texture, setTexture] = useState<Texture | null>(null);
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  useEffect(() => {
    if (!url) {
      setTexture(null);
      return;
    }

    let active = true;
    const loader = new TextureLoader();
    setTexture(null);
    loader.load(
      url,
      (loadedTexture) => {
        if (!active) {
          loadedTexture.dispose();
          return;
        }
        configureMipmappedTexture(loadedTexture, anisotropy);
        setTexture(loadedTexture);
      },
      undefined,
      (error) => {
        if (active) {
          setTexture(null);
          onErrorRef.current?.(error);
        }
      },
    );

    return () => {
      active = false;
    };
  }, [anisotropy, url]);

  useEffect(
    () => () => {
      texture?.dispose();
    },
    [texture],
  );

  return texture;
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
