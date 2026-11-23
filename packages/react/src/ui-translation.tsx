import { createContext, useContext, type ReactNode } from "react";

export type PanoUiTranslate = (message: string) => string;

const identity: PanoUiTranslate = (message) => message;
const PanoUiTranslationContext = createContext<PanoUiTranslate>(identity);

/** Translate built-in control text within this part of the React tree. */
export function PanoUiTranslationProvider({ translate, children }: {
  translate: PanoUiTranslate;
  children: ReactNode;
}) {
  return (
    <PanoUiTranslationContext.Provider value={translate}>
      {children}
    </PanoUiTranslationContext.Provider>
  );
}

export function usePanoUiTranslation(): PanoUiTranslate {
  return useContext(PanoUiTranslationContext);
}
