import { useEffect, useId, useRef, useState } from "react";
import { trackCta } from "../analytics";
import { cn } from "../cn";
import { HEADER_LINKS } from "../links";
import {
  HOME_ROUTE,
  matchPlaygroundRoute,
  playgroundNavSections,
  type PlaygroundNavGroupId,
} from "../routes";

const NAV_BREAKPOINT_PX = 960;

const inlineLinkClassName =
  "border border-transparent bg-transparent px-[9px] py-[7px] font-mono text-[0.64rem] tracking-[0.06em] text-[#769198] uppercase no-underline transition hover:border-[#3e6c73] hover:text-[#dcecef]";

const inlineLinkActiveClassName =
  "border-[#3e6c73] text-[#dcecef] shadow-[inset_0_-2px_0_0_#df6b42]";

const externalLinkClassName =
  "group relative inline-flex size-9 items-center justify-center border border-transparent text-[#75cbd3] no-underline transition hover:border-[#3e6c73] hover:text-[#dcecef] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

const externalLinkTooltipClassName =
  "pointer-events-none absolute top-full left-1/2 z-30 mt-1.5 -translate-x-1/2 border border-[#244047] bg-[#08191d] px-2 py-1 font-mono text-[0.62rem] tracking-[0.08em] text-[#dcecef] uppercase opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100";

const menuLinkClassName =
  "block px-3 py-2 font-mono text-[0.64rem] tracking-[0.06em] text-[#769198] uppercase no-underline transition hover:bg-[#102b31] hover:text-[#dcecef] focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent";

const menuLinkActiveClassName =
  "bg-[#102b31] text-[#dcecef] shadow-[inset_2px_0_0_0_#df6b42]";

const menuPanelClassName =
  "z-40 max-h-[min(70vh,24rem)] overflow-y-auto border border-[#3e6c73] bg-[#08191d] py-1 shadow-[0_18px_40px_rgb(0_0_0_/_0.45)]";

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

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      aria-hidden
      className={cn(
        "size-2.5 shrink-0 opacity-70 transition-transform motion-reduce:transition-none",
        open && "rotate-180",
      )}
      fill="none"
      viewBox="0 0 12 12"
    >
      <path
        d="M2.5 4.5 6 8l3.5-3.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
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
  const sections = playgroundNavSections();
  const navId = useId();
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const desktopNavRef = useRef<HTMLElement>(null);
  const openGroupIdRef = useRef<PlaygroundNavGroupId | null>(null);
  const buttonRefs = useRef(new Map<PlaygroundNavGroupId, HTMLButtonElement>());
  const [openGroupId, setOpenGroupId] = useState<PlaygroundNavGroupId | null>(null);

  function updateOpenGroupId(next: PlaygroundNavGroupId | null) {
    openGroupIdRef.current = next;
    setOpenGroupId(next);
  }

  useEffect(() => {
    function closeDesktop(restoreFocus: boolean) {
      const current = openGroupIdRef.current;
      if (!current) {
        return;
      }
      openGroupIdRef.current = null;
      setOpenGroupId(null);
      if (restoreFocus) {
        buttonRefs.current.get(current)?.focus();
      }
    }

    function closeMobile() {
      detailsRef.current?.removeAttribute("open");
    }

    function onPointerDown(event: PointerEvent) {
      const menu = detailsRef.current;
      if (menu?.open && event.target instanceof Node && !menu.contains(event.target)) {
        closeMobile();
      }
      if (
        openGroupIdRef.current &&
        event.target instanceof Node &&
        !desktopNavRef.current?.contains(event.target)
      ) {
        closeDesktop(false);
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") {
        return;
      }
      closeMobile();
      closeDesktop(true);
    }

    function onResize() {
      if (window.innerWidth >= NAV_BREAKPOINT_PX) {
        closeMobile();
      } else {
        closeDesktop(false);
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

  function focusGroupButton(index: number) {
    const next = (index + sections.length) % sections.length;
    const id = sections[next]?.id;
    if (!id) {
      return;
    }
    updateOpenGroupId(null);
    buttonRefs.current.get(id)?.focus();
  }

  return (
    <header className="relative z-20 flex items-center justify-between gap-3 border-b border-[#244047] pb-[17px]">
      <a
        aria-label="Pano View home"
        className="shrink-0 text-base font-extrabold tracking-[-0.06em] text-[#f5fbfc] no-underline"
        href={HOME_ROUTE.path}
      >
        PANO<span className="mx-[0.08em] text-[#df6b42]">/</span>VIEW
      </a>
      <nav
        aria-label="Playground pages"
        className="hidden gap-1.5 min-[960px]:flex"
        ref={desktopNavRef}
      >
        {sections.map((section, index) => {
          const isCurrent = activeRoute.group === section.id;
          const open = openGroupId === section.id;
          const panelId = `${navId}-${section.id}`;
          return (
            <div className="relative" key={section.id}>
              <button
                aria-controls={panelId}
                aria-expanded={open}
                className={cn(
                  inlineLinkClassName,
                  "inline-flex items-center gap-1.5 whitespace-nowrap",
                  (isCurrent || open) && inlineLinkActiveClassName,
                )}
                onClick={() => updateOpenGroupId(open ? null : section.id)}
                onKeyDown={(event) => {
                  if (event.key === "ArrowDown") {
                    event.preventDefault();
                    updateOpenGroupId(section.id);
                    const firstLinkId = `${panelId}-link-0`;
                    requestAnimationFrame(() => document.getElementById(firstLinkId)?.focus());
                  } else if (event.key === "ArrowRight") {
                    event.preventDefault();
                    focusGroupButton(index + 1);
                  } else if (event.key === "ArrowLeft") {
                    event.preventDefault();
                    focusGroupButton(index - 1);
                  }
                }}
                ref={(node) => {
                  if (node) {
                    buttonRefs.current.set(section.id, node);
                  } else {
                    buttonRefs.current.delete(section.id);
                  }
                }}
                type="button"
              >
                {isCurrent ? (
                  <span className="inline-flex items-center gap-1.5">
                    <span className="text-[0.58rem] text-[#769198]">{section.label}</span>
                    <span aria-hidden className="text-[#df6b42]">
                      /
                    </span>
                    <span>{activeRoute.navLabel}</span>
                  </span>
                ) : (
                  section.label
                )}
                <ChevronIcon open={open} />
              </button>
              {open ? (
                <div
                  className={cn(
                    menuPanelClassName,
                    "absolute top-[calc(100%+6px)] left-0 min-w-[max(12rem,100%)]",
                  )}
                  id={panelId}
                  onKeyDown={(event) => {
                    const links = Array.from(
                      event.currentTarget.querySelectorAll<HTMLAnchorElement>("a[href]"),
                    );
                    const currentIndex = links.findIndex((link) => link === document.activeElement);
                    if (event.key === "ArrowDown") {
                      event.preventDefault();
                      links[Math.min(currentIndex + 1, links.length - 1)]?.focus();
                    } else if (event.key === "ArrowUp") {
                      event.preventDefault();
                      if (currentIndex <= 0) {
                        buttonRefs.current.get(section.id)?.focus();
                      } else {
                        links[currentIndex - 1]?.focus();
                      }
                    } else if (event.key === "Escape") {
                      event.preventDefault();
                      updateOpenGroupId(null);
                      buttonRefs.current.get(section.id)?.focus();
                    }
                  }}
                >
                  {section.routes.map((route, routeIndex) => (
                    <a
                      aria-current={activeRoute.path === route.path ? "page" : undefined}
                      className={cn(
                        menuLinkClassName,
                        "whitespace-nowrap",
                        activeRoute.path === route.path && menuLinkActiveClassName,
                      )}
                      href={route.path}
                      id={`${panelId}-link-${routeIndex}`}
                      key={route.path}
                    >
                      {route.navLabel}
                    </a>
                  ))}
                </div>
              ) : null}
            </div>
          );
        })}
      </nav>
      <ProjectLinks className="ml-auto" />
      <details className="group relative min-[960px]:hidden" ref={detailsRef}>
        <summary
          aria-label="Open playground pages"
          className="flex size-9 cursor-pointer list-none items-center justify-center border border-[#3e6c73] text-[#dcecef] transition hover:border-[#75cbd3] marker:content-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent group-open:border-[#df6b42] [&::-webkit-details-marker]:hidden"
        >
          <MenuIcon />
          <CloseIcon />
        </summary>
        <nav
          aria-label="Playground pages"
          className={cn(
            menuPanelClassName,
            "absolute right-0 mt-1.5 w-60",
          )}
        >
          {sections.map((section, index) => (
            <div className={cn(index > 0 && "mt-1 border-t border-[#244047] pt-1")} key={section.id}>
              <p className="px-3 pt-1.5 pb-1 font-mono text-[0.6rem] tracking-[0.08em] text-[#75cbd3] uppercase">
                {section.label}
              </p>
              {section.routes.map((route) => (
                <a
                  aria-current={activeRoute.path === route.path ? "page" : undefined}
                  className={cn(
                    menuLinkClassName,
                    activeRoute.path === route.path && menuLinkActiveClassName,
                  )}
                  href={route.path}
                  key={route.path}
                >
                  {route.navLabel}
                </a>
              ))}
            </div>
          ))}
        </nav>
      </details>
    </header>
  );
}
