import { cn } from "../cn";
import { DEFAULT_PLAYGROUND_ROUTE, matchPlaygroundRoute, PLAYGROUND_ROUTES } from "../routes";

export function SiteHeader() {
  const activeRoute = matchPlaygroundRoute(window.location.pathname);

  return (
    <header className="flex items-center justify-between gap-3 border-b border-[#244047] pb-[17px] max-[760px]:gap-3">
      <a
        aria-label="Pano View home"
        className="text-base font-extrabold tracking-[-0.06em] text-[#f5fbfc] no-underline"
        href={DEFAULT_PLAYGROUND_ROUTE.path}
      >
        PANO<span className="mx-[0.08em] text-[#df6b42]">/</span>VIEW
      </a>
      <nav
        aria-label="Playground pages"
        className="ml-auto flex gap-1.5 max-[760px]:ml-auto"
      >
        {PLAYGROUND_ROUTES.map((route) => (
          <a
            aria-current={activeRoute.path === route.path ? "page" : undefined}
            className={cn(
              "border border-transparent px-[9px] py-[7px] font-mono text-[0.64rem] tracking-[0.06em] text-[#769198] uppercase no-underline transition hover:border-[#3e6c73] hover:text-[#dcecef] max-[760px]:px-1.5 max-[760px]:py-1.5 max-[760px]:text-[0.55rem]",
              activeRoute.path === route.path &&
                "border-[#3e6c73] text-[#dcecef] shadow-[inset_0_-2px_0_0_#df6b42]",
            )}
            href={route.path}
            key={route.path}
          >
            {route.navLabel}
          </a>
        ))}
      </nav>
      <p className="m-0 font-mono text-[0.7rem] tracking-[0.08em] text-[#769198] max-[760px]:hidden">
        {activeRoute.stageLabel}
      </p>
    </header>
  );
}
