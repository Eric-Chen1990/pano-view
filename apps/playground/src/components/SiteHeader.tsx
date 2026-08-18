import { useEffect, useRef } from "react";
import { cn } from "../cn";
import { DEFAULT_PLAYGROUND_ROUTE, matchPlaygroundRoute, PLAYGROUND_ROUTES } from "../routes";

const NAV_BREAKPOINT_PX = 960;

const inlineLinkClassName =
  "border border-transparent px-[9px] py-[7px] font-mono text-[0.64rem] tracking-[0.06em] text-[#769198] uppercase no-underline transition hover:border-[#3e6c73] hover:text-[#dcecef]";

const inlineLinkActiveClassName =
  "border-[#3e6c73] text-[#dcecef] shadow-[inset_0_-2px_0_0_#df6b42]";

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
        className="text-base font-extrabold tracking-[-0.06em] text-[#f5fbfc] no-underline"
        href={DEFAULT_PLAYGROUND_ROUTE.path}
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
      <details className="group relative ml-auto min-[960px]:hidden" ref={detailsRef}>
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
