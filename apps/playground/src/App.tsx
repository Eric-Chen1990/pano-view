import { usePlaygroundLanguage } from "./i18n/language";
import { PAGE_META } from "./page-meta";
import { SiteHeader } from "./components/SiteHeader";
import { shellClassName } from "./ui";
import { Suspense, useEffect } from "react";
import { Analytics } from "@vercel/analytics/react";
import { isKnownPlaygroundRoute, matchPlaygroundRoute } from "./routes";

export function App() {
  const pathname = window.location.pathname;
  const { locale, t } = usePlaygroundLanguage();
  const { Component, path } = matchPlaygroundRoute(pathname);

  useEffect(() => {
    document.documentElement.lang = locale;
    document.title = t(PAGE_META[path].title);
    document.querySelector('meta[name="description"]')?.setAttribute("content", t(PAGE_META[path].description));
  }, [locale, path, t]);

  useEffect(() => {
    if (isKnownPlaygroundRoute(pathname)) {
      return;
    }

    window.history.replaceState(
      null,
      "",
      "/" + window.location.search + window.location.hash,
    );
  }, [pathname]);

  return (
    <>
      <Suspense fallback={(
        <main className={shellClassName}>
          <SiteHeader />
          <p role="status">{t("Loading…")}</p>
        </main>
      )}>
        <Component />
      </Suspense>
      {pathname !== "/editor" ? <Analytics /> : null}
    </>
  );
}
