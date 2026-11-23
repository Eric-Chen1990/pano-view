import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { PlaygroundLanguageProvider } from "./i18n/language";
import { App } from "./App";
import "@ericchen1990/pano-view/styles.css";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <PlaygroundLanguageProvider>
      <App />
    </PlaygroundLanguageProvider>
  </StrictMode>,
);
