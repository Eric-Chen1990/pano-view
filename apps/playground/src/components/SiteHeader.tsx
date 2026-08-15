import { DEFAULT_PLAYGROUND_ROUTE, matchPlaygroundRoute, PLAYGROUND_ROUTES } from "../routes";

export function SiteHeader() {
  const activeRoute = matchPlaygroundRoute(window.location.pathname);

  return (
    <header className="topbar">
      <a className="wordmark" href={DEFAULT_PLAYGROUND_ROUTE.path} aria-label="Pano View home">
        PANO<span>/</span>VIEW
      </a>
      <nav className="bench-nav" aria-label="Playground pages">
        {PLAYGROUND_ROUTES.map((route) => (
          <a
            aria-current={activeRoute.path === route.path ? "page" : undefined}
            href={route.path}
            key={route.path}
          >
            {route.navLabel}
          </a>
        ))}
      </nav>
      <p>{activeRoute.stageLabel}</p>
    </header>
  );
}
