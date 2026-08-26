import { useEffect } from "react";
import { Analytics } from "@vercel/analytics/react";
import { isKnownPlaygroundRoute, matchPlaygroundRoute } from "./routes";

export function App() {
  const pathname = window.location.pathname;
  const { Component } = matchPlaygroundRoute(pathname);

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
      <Component />
      <Analytics />
    </>
  );
}
