import { useEffect, useRef } from "react";
import { trackCta } from "../analytics";
import { cn } from "../cn";
import { HEADER_LINKS } from "../links";
import { HOME_ROUTE, matchPlaygroundRoute, PLAYGROUND_ROUTES } from "../routes";

const NAV_BREAKPOINT_PX = 960;

const inlineLinkClassName =
  "border border-transparent px-[9px] py-[7px] font-mono text-[0.64rem] tracking-[0.06em] text-[#769198] uppercase no-underline transition hover:border-[#3e6c73] hover:text-[#dcecef]";

const inlineLinkActiveClassName =
  "border-[#3e6c73] text-[#dcecef] shadow-[inset_0_-2px_0_0_#df6b42]";

const externalLinkClassName =
  "group relative inline-flex size-9 items-center justify-center border border-transparent text-[#75cbd3] no-underline transition hover:border-[#3e6c73] hover:text-[#dcecef]";

const externalLinkTooltipClassName =
  "pointer-events-none absolute top-full left-1/2 z-30 mt-1.5 -translate-x-1/2 border border-[#244047] bg-[#08191d] px-2 py-1 font-mono text-[0.62rem] tracking-[0.08em] text-[#dcecef] uppercase opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100";

const menuLinkClassName =
  "block px-3 py-2 font-mono text-[0.64rem] tracking-[0.06em] text-[#769198] uppercase no-underline transition hover:bg-[#102b31] hover:text-[#dcecef]";

const menuLinkActiveClassName =
  "bg-[#102b31] text-[#dcecef] shadow-[inset_2px_0_0_0_#df6b42]";

function MenuIcon() {
  return (
    <svg
      aria-hidden
      className="size-4 group-open:hidden"
      fill="none"
      viewBox="0 0 16 16"
    >
      <path
        d="M2.5 4h11M2.5 8h11M2.5 12h11"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.5"
      />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      aria-hidden
      className="hidden size-4 group-open:block"
      fill="none"
      viewBox="0 0 16 16"
    >
      <path
        d="m4 4 8 8M12 4 4 12"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.5"
      />
    </svg>
  );
}

function GitHubIcon() {
  return (
    <svg aria-hidden className="size-4" fill="currentColor" viewBox="0 0 16 16">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82A7.7 7.7 0 0 1 8 4.77c.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8" />
    </svg>
  );
}

function NpmIcon() {
  return (
    <svg aria-hidden className="size-4" fill="currentColor" viewBox="0 0 16 16">
      <path d="M0 0v16h16V0zm13 13h-2V5H8v8H3V3h10z" />
    </svg>
  );
}

function PlaygroundLinks({
  activePath,
  itemClassName,
  activeItemClassName,
}: {
  activePath: string;
  itemClassName: string;
  activeItemClassName: string;
}) {
  return PLAYGROUND_ROUTES.map((route) => (
    <a
      aria-current={activePath === route.path ? "page" : undefined}
      className={cn(itemClassName, activePath === route.path && activeItemClassName)}
      href={route.path}
      key={route.path}
    >
      {route.navLabel}
    </a>
  ));
}

function ProjectLinks({ className }: { className?: string }) {
  return (
    <nav aria-label="Project links" className={cn("flex shrink-0 gap-1", className)}>
      <a
        aria-label="GitHub repository"
        className={externalLinkClassName}
        href={HEADER_LINKS.github}
        onClick={() => trackCta("open_github", HEADER_LINKS.github)}
        rel="noreferrer"
        target="_blank"
      >
        <GitHubIcon />
        <span aria-hidden className={externalLinkTooltipClassName}>
          GitHub
        </span>
      </a>
      <a
        aria-label="npm package"
        className={externalLinkClassName}
        href={HEADER_LINKS.npm}
        onClick={() => trackCta("open_npm", HEADER_LINKS.npm)}
        rel="noreferrer"
        target="_blank"
      >
        <NpmIcon />
        <span aria-hidden className={externalLinkTooltipClassName}>
          npm
        </span>
      </a>
    </nav>
  );
}

export function SiteHeader() {
  const activeRoute = matchPlaygroundRoute(window.location.pathname);
  const detailsRef = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    function closeMenu() {
      detailsRef.current?.removeAttribute("open");
    }

    function onPointerDown(event: PointerEvent) {
      const menu = detailsRef.current;
      if (!menu?.open) {
        return;
      }
      if (event.target instanceof Node && menu.contains(event.target)) {
        return;
      }
      closeMenu();
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeMenu();
      }
    }

    function onResize() {
      if (window.innerWidth >= NAV_BREAKPOINT_PX) {
        closeMenu();
      }
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", onResize);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return (
    <header className="flex items-center justify-between gap-3 border-b border-[#244047] pb-[17px]">
      <a
        aria-label="Pano View home"
        className="shrink-0 text-base font-extrabold tracking-[-0.06em] text-[#f5fbfc] no-underline"
        href={HOME_ROUTE.path}
      >
        PANO<span className="mx-[0.08em] text-[#df6b42]">/</span>VIEW
      </a>
      <nav
        aria-label="Playground pages"
        className="ml-auto hidden gap-1.5 min-[960px]:flex"
      >
        <PlaygroundLinks
          activeItemClassName={inlineLinkActiveClassName}
          activePath={activeRoute.path}
          itemClassName={inlineLinkClassName}
        />
      </nav>
      <ProjectLinks className="ml-auto min-[960px]:ml-1.5" />
      <details className="group relative min-[960px]:hidden" ref={detailsRef}>
        <summary
          aria-label="Open playground pages"
          className="flex size-9 cursor-pointer list-none items-center justify-center border border-[#3e6c73] text-[#dcecef] transition hover:border-[#75cbd3] marker:content-none group-open:border-[#df6b42] [&::-webkit-details-marker]:hidden"
        >
          <MenuIcon />
          <CloseIcon />
        </summary>
        <nav
          aria-label="Playground pages"
          className="absolute right-0 z-20 mt-1.5 min-w-[13.5rem] border border-[#244047] bg-[#08191d] py-1"
        >
          <PlaygroundLinks
            activeItemClassName={menuLinkActiveClassName}
            activePath={activeRoute.path}
            itemClassName={menuLinkClassName}
          />
        </nav>
      </details>
    </header>
  );
}
