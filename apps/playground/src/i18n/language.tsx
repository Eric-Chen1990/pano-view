import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { PanoUiTranslationProvider } from "@ericchen1990/pano-view";
import { translateMessage, type PlaygroundLocale, type Translate } from "./locale";

const storageKey = "pano-view.playground.locale";

type PlaygroundLanguage = {
  locale: PlaygroundLocale;
  setLocale: (locale: PlaygroundLocale) => void;
  t: Translate;
};

const LanguageContext = createContext<PlaygroundLanguage | null>(null);

function initialLocale(): PlaygroundLocale {
  try {
    return window.localStorage.getItem(storageKey) === "zh-CN" ? "zh-CN" : "en";
  } catch {
    return "en";
  }
}

export function PlaygroundLanguageProvider({ children }: { children: ReactNode }) {
  const [locale, updateLocale] = useState(initialLocale);
  const language = useMemo<PlaygroundLanguage>(() => ({
    locale,
    setLocale(next) {
      updateLocale(next);
      try {
        window.localStorage.setItem(storageKey, next);
      } catch {
        // The active page can still switch languages.
      }
    },
    t: (message, values) => translateMessage(locale, message, values),
  }), [locale]);

  return (
    <LanguageContext.Provider value={language}>
      <PanoUiTranslationProvider translate={language.t}>
        {children}
      </PanoUiTranslationProvider>
    </LanguageContext.Provider>
  );
}

export function usePlaygroundLanguage(): PlaygroundLanguage {
  const language = useContext(LanguageContext);
  if (!language) throw new Error("Missing PlaygroundLanguageProvider");
  return language;
}
