import { playgroundNavSections } from "../../routes";
import { PAGE_META } from "../../page-meta";
import { trackCta, trackDemoOpened, trackInstallCopied } from "../../analytics";
import { LANDING_LINKS } from "../../links";
import { cardClassName, monoLabelClassName, shellClassName } from "../../ui";
import { CodeSnippet } from "../CodeSnippet";
import { SiteFooter } from "../SiteFooter";
import { SiteHeader } from "../SiteHeader";

const installCommand = "pnpm add @ericchen1990/pano-view";
const peerDependencies =
  "pnpm add three @react-three/fiber @react-three/drei @react-three/xr";

const featuredDemos = [
  {
    eyebrow: "1 · Load a panorama",
    title: "Start with one panorama source",
    description:
      "Compare Sphere images and cube tiles, understand resource paths, and observe previews and loading.",
    href: "/basics",
    demo: "basics",
  },
  {
    eyebrow: "2 · Add interaction",
    title: "Control the view, then place hotspots",
    description:
      "Learn direct input, view navigation, rotation and gyro. Continue with the hotspot bench to add content.",
    href: "/controls",
    demo: "controls",
  },
  {
    eyebrow: "3 · Build a tour",
    title: "Connect scenes with static JSON",
    description:
      "See how project loading, navigation, hotspot actions and shared popup content work together.",
    href: "/project",
    demo: "project",
  },
] as const;

const primaryLinkClassName =
  "inline-flex min-h-11 items-center justify-center border border-[#df6b42] bg-[#df6b42] px-4 text-sm font-semibold text-white no-underline transition hover:border-[#ef855e] hover:bg-[#ef855e]";
const secondaryLinkClassName =
  "inline-flex min-h-11 items-center justify-center border border-[#3e6c73] px-4 text-sm font-semibold text-[#f5fbfc] no-underline transition hover:border-[#75cbd3] hover:bg-[#102b31]";

export function LandingPage() {
  return (
    <main className={shellClassName}>
      <SiteHeader />

      <section className="grid items-center gap-10 py-[clamp(3.5rem,9vw,8rem)] lg:grid-cols-[minmax(0,1.1fr)_minmax(20rem,0.9fr)]">
        <div>
          <p className={monoLabelClassName}>React panorama viewer</p>
          <h1 className="m-0 mt-4 max-w-[13ch] text-[clamp(3.25rem,8vw,7rem)] leading-[0.88] font-black tracking-[-0.065em] text-[#f5fbfc]">
            Build the view beyond the viewport.
          </h1>
          <p className="mt-7 max-w-[41rem] text-[1.05rem] leading-8 text-[#9ab1b7]">
            Composable React components for equirectangular images, 360 video,
            and krpano-style multiresolution cube tiles—without giving your
            interface to a viewer runtime.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a
              className={primaryLinkClassName}
              href="/basics"
              onClick={() => trackCta("explore_interactive_demos", "/basics")}
            >
              Start with panorama basics
            </a>
            <a
              className={secondaryLinkClassName}
              href="#install"
              onClick={() => trackCta("install_package", "#install")}
            >
              Install package
            </a>
          </div>
        </div>

        <figure className={cardClassName + " relative m-0 overflow-hidden p-3"}>
          <img
            alt="Panorama preview from the Pano View playground"
            className="aspect-[1.45/1] w-full object-cover opacity-90"
            src="/fixtures/panorama/panos/1/preview.webp"
          />
          <figcaption className="absolute right-7 bottom-7 max-w-[16rem] border border-[#3e6c73] bg-[#071316]/90 px-4 py-3 font-mono text-[0.68rem] leading-5 tracking-[0.06em] text-[#dcecef] uppercase">
            One React-owned scene. Your controls, your UI, your data.
          </figcaption>
        </figure>
      </section>

      <section
        aria-labelledby="featured-demos"
        className="border-t border-[#244047] py-10"
      >
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className={monoLabelClassName}>Choose a starting point</p>
            <h2
              className="m-0 mt-2 text-[clamp(2rem,4vw,3.75rem)] leading-none font-black tracking-tight text-[#f5fbfc]"
              id="featured-demos"
            >
              Follow the learning path.
            </h2>
          </div>
          <a
            className="font-mono text-xs tracking-[0.08em] text-[#75cbd3] uppercase"
            href="#example-catalog"
            onClick={() => trackCta("browse_examples", "#example-catalog")}
          >
            Browse all 17 examples →
          </a>
        </div>
        <div className="mt-7 grid gap-4 lg:grid-cols-3">
          {featuredDemos.map((demo) => (
            <a
              className={
                cardClassName +
                " group flex min-h-60 flex-col p-6 no-underline transition hover:border-[#75cbd3] hover:bg-[#102b31]"
              }
              href={demo.href}
              key={demo.demo}
              onClick={() => trackDemoOpened(demo.demo)}
            >
              <span className={monoLabelClassName}>{demo.eyebrow}</span>
              <h3 className="m-0 mt-5 text-2xl leading-tight font-bold text-[#f5fbfc]">
                {demo.title}
              </h3>
              <p className="mb-0 mt-4 text-sm leading-6 text-[#9ab1b7]">
                {demo.description}
              </p>
              <span className="mt-auto pt-6 font-mono text-xs tracking-[0.08em] text-[#75cbd3] uppercase">
                Open demo →
              </span>
            </a>
          ))}
        </div>
      </section>

      <section
        id="example-catalog"
        aria-labelledby="catalog-title"
        className="border-t border-line py-10"
      >
        <p className={monoLabelClassName}>Examples by learning task</p>
        <h2 id="catalog-title" className="text-3xl font-bold">
          Choose a focused topic or a complete integration.
        </h2>
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {playgroundNavSections().map((section) => (
            <section key={section.id} className={cardClassName + " p-5"}>
              <h3 className="mt-0 text-lg font-bold text-accent">
                {section.label}
              </h3>
              <ul className="m-0 list-none space-y-5 p-0">
                {section.routes.map((route) => (
                  <li key={route.path}>
                    <a
                      href={route.path}
                      className="font-semibold underline decoration-line-3 underline-offset-4 hover:text-accent"
                      onClick={() => trackDemoOpened(route.path.slice(1))}
                    >
                      {route.navLabel} →
                    </a>
                    <p className="mb-0 mt-2 text-xs leading-6 text-muted-2">
                      {PAGE_META[route.path].description}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </section>

      <section
        className="grid grid-cols-1 gap-6 border-t border-[#244047] py-10 lg:grid-cols-[0.8fr_1.2fr]"
        id="krpano"
      >
        <div>
          <p className={monoLabelClassName}>Moving from krpano</p>
          <h2 className="m-0 mt-2 text-[clamp(2rem,4vw,3.75rem)] leading-none font-black tracking-tight text-[#f5fbfc]">
            Reuse the tile pyramid. Own the experience.
          </h2>
        </div>
        <div className={cardClassName + " p-6"}>
          <p className="m-0 text-base leading-7 text-[#c2d7da]">
            Copy the existing krpano <code>&lt;cube&gt;</code> URL and multires
            values into <code>urlTemplate</code> and <code>multires</code>, then
            pass <code>&lt;preview url&gt;</code> to <code>previewUrl</code>.
            Pano View supports this tile output format, but is not a krpano
            plugin, wrapper, or affiliated project.
          </p>
          <div className="mt-6 flex flex-wrap gap-x-5 gap-y-3 text-sm">
            <a
              className="text-[#75cbd3]"
              href={LANDING_LINKS.krpanoGuide}
              onClick={() =>
                trackCta("read_krpano_guide", LANDING_LINKS.krpanoGuide)
              }
            >
              Read the English migration guide →
            </a>
            <a
              className="text-[#75cbd3]"
              href={LANDING_LINKS.krpanoGuideChinese}
              onClick={() =>
                trackCta(
                  "read_krpano_guide_zh",
                  LANDING_LINKS.krpanoGuideChinese,
                )
              }
            >
              阅读中文迁移指南 →
            </a>
          </div>
        </div>
      </section>

      <section className="border-t border-[#244047] py-10" id="install">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <p className={monoLabelClassName}>Start in minutes</p>
            <h2 className="m-0 mt-2 text-[clamp(2rem,4vw,3.75rem)] leading-none font-black tracking-tight text-[#f5fbfc]">
              Install the package. Keep the canvas yours.
            </h2>
            <p className="mt-5 max-w-[34rem] text-sm leading-7 text-[#9ab1b7]">
              Install the package in your React application, then use the
              compatible peer dependencies already chosen by your app. Read the
              package README before upgrading peer versions.
            </p>
          </div>
          <div className="grid gap-4">
            <CodeSnippet
              blurb="Add the package to an existing React application."
              code={installCommand}
              label="Install Pano View"
              language="bash"
              onCopy={() => trackInstallCopied("pnpm")}
            />
            <CodeSnippet
              blurb="Install these only when your app does not already provide the required peer dependencies."
              code={peerDependencies}
              label="Peer dependencies"
              language="bash"
              onCopy={() => trackInstallCopied("pnpm-peer-dependencies")}
            />
          </div>
        </div>
      </section>

      <section
        aria-labelledby="documentation-links"
        className="border-t border-[#244047] py-10"
      >
        <p className={monoLabelClassName}>Documentation</p>
        <h2
          className="m-0 mt-2 text-[clamp(2rem,4vw,3.75rem)] leading-none font-black tracking-tight text-[#f5fbfc]"
          id="documentation-links"
        >
          Keep exploring in the format you need.
        </h2>
        <div className="mt-7 flex flex-wrap gap-x-6 gap-y-4 text-sm">
          <a
            href={LANDING_LINKS.github}
            onClick={() => trackCta("open_github", LANDING_LINKS.github)}
          >
            GitHub repository →
          </a>
          <a
            href={LANDING_LINKS.npm}
            onClick={() => trackCta("open_npm", LANDING_LINKS.npm)}
          >
            npm package →
          </a>
          <a
            href={LANDING_LINKS.videoGuide}
            onClick={() =>
              trackCta("read_video_guide", LANDING_LINKS.videoGuide)
            }
          >
            English 360 video guide →
          </a>
          <a
            href={LANDING_LINKS.videoGuideChinese}
            onClick={() =>
              trackCta("read_video_guide_zh", LANDING_LINKS.videoGuideChinese)
            }
          >
            中文 360 视频指南 →
          </a>
        </div>
      </section>

      <SiteFooter label="@ericchen1990/pano-view · React panorama components" />
    </main>
  );
}
