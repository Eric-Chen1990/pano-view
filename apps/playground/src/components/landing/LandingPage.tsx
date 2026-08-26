import { trackCta, trackDemoOpened, trackInstallCopied } from "../../analytics";
import {
  cardClassName,
  footerClassName,
  monoLabelClassName,
  shellClassName,
} from "../../ui";
import { CodeSnippet } from "../CodeSnippet";
import { SiteHeader } from "../SiteHeader";

const installCommand = "pnpm add @ericchen1990/pano-view";
const peerDependencies =
  "pnpm add three @react-three/fiber @react-three/drei @react-three/xr";

const externalLinks = {
  github:
    "https://github.com/Eric-Chen1990/pano-view?utm_source=playground&utm_medium=product&utm_campaign=landing-page&utm_content=github",
  npm:
    "https://www.npmjs.com/package/@ericchen1990/pano-view?utm_source=playground&utm_medium=product&utm_campaign=landing-page&utm_content=npm",
  krpanoGuide:
    "https://github.com/Eric-Chen1990/pano-view/blob/main/docs/krpano-migration.md?utm_source=playground&utm_medium=product&utm_campaign=landing-page&utm_content=krpano-guide",
  krpanoGuideChinese:
    "https://github.com/Eric-Chen1990/pano-view/blob/main/docs/krpano-migration.zh-CN.md?utm_source=playground&utm_medium=product&utm_campaign=landing-page&utm_content=krpano-guide-zh",
  videoGuide:
    "https://github.com/Eric-Chen1990/pano-view/blob/main/docs/react-360-video.md?utm_source=playground&utm_medium=product&utm_campaign=landing-page&utm_content=video-guide",
  videoGuideChinese:
    "https://github.com/Eric-Chen1990/pano-view/blob/main/docs/react-360-video.zh-CN.md?utm_source=playground&utm_medium=product&utm_campaign=landing-page&utm_content=video-guide-zh",
} as const;

const featuredDemos = [
  {
    eyebrow: "Hotspot authoring",
    title: "Place rich hotspots in panorama space",
    description:
      "Build image, text, media, polygon, and polyline interactions directly in a 360° scene.",
    href: "/hotspots",
    demo: "hotspots",
  },
  {
    eyebrow: "Scenes + tiles",
    title: "Blend scenes without giving up multires tiles",
    description:
      "Move between equirectangular and cube-tile scenes while retaining React-owned controls and UI.",
    href: "/scene-transitions",
    demo: "scene-transitions",
  },
  {
    eyebrow: "Video + WebXR",
    title: "Bring 360 video to the web, inline",
    description:
      "Use custom playback chrome, captions, mobile-safe activation, and immersive viewing when available.",
    href: "/video",
    demo: "video",
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
            Composable React components for equirectangular images, 360 video, and krpano-style
            multiresolution cube tiles—without giving your interface to a viewer runtime.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a
              className={primaryLinkClassName}
              href="/hotspots"
              onClick={() => trackCta("explore_interactive_demos", "/hotspots")}
            >
              Explore interactive demos
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

      <section aria-labelledby="featured-demos" className="border-t border-[#244047] py-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className={monoLabelClassName}>Choose a starting point</p>
            <h2
              className="m-0 mt-2 text-[clamp(2rem,4vw,3.75rem)] leading-none font-black tracking-tight text-[#f5fbfc]"
              id="featured-demos"
            >
              Explore the working surfaces.
            </h2>
          </div>
          <a
            className="font-mono text-xs tracking-[0.08em] text-[#75cbd3] uppercase"
            href="/filters"
            onClick={() => trackDemoOpened("filters")}
          >
            Open filters demo →
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
              <p className="mb-0 mt-4 text-sm leading-6 text-[#9ab1b7]">{demo.description}</p>
              <span className="mt-auto pt-6 font-mono text-xs tracking-[0.08em] text-[#75cbd3] uppercase">
                Open demo →
              </span>
            </a>
          ))}
        </div>
      </section>

      <section
        className="grid gap-6 border-t border-[#244047] py-10 lg:grid-cols-[0.8fr_1.2fr]"
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
            Copy the existing krpano <code>&lt;cube&gt;</code> URL and multires values into{" "}
            <code>urlTemplate</code> and <code>multires</code>, then pass <code>&lt;preview url&gt;</code>{" "}
            to <code>previewUrl</code>. Pano View supports this tile output format, but is not a
            krpano plugin, wrapper, or affiliated project.
          </p>
          <div className="mt-6 flex flex-wrap gap-x-5 gap-y-3 text-sm">
            <a
              className="text-[#75cbd3]"
              href={externalLinks.krpanoGuide}
              onClick={() => trackCta("read_krpano_guide", externalLinks.krpanoGuide)}
            >
              Read the English migration guide →
            </a>
            <a
              className="text-[#75cbd3]"
              href={externalLinks.krpanoGuideChinese}
              onClick={() => trackCta("read_krpano_guide_zh", externalLinks.krpanoGuideChinese)}
            >
              阅读中文迁移指南 →
            </a>
          </div>
        </div>
      </section>

      <section className="border-t border-[#244047] py-10" id="install">
        <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <p className={monoLabelClassName}>Start in minutes</p>
            <h2 className="m-0 mt-2 text-[clamp(2rem,4vw,3.75rem)] leading-none font-black tracking-tight text-[#f5fbfc]">
              Install the package. Keep the canvas yours.
            </h2>
            <p className="mt-5 max-w-[34rem] text-sm leading-7 text-[#9ab1b7]">
              Install the package in your React application, then use the compatible peer
              dependencies already chosen by your app. Read the package README before upgrading
              peer versions.
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

      <section aria-labelledby="documentation-links" className="border-t border-[#244047] py-10">
        <p className={monoLabelClassName}>Documentation</p>
        <h2
          className="m-0 mt-2 text-[clamp(2rem,4vw,3.75rem)] leading-none font-black tracking-tight text-[#f5fbfc]"
          id="documentation-links"
        >
          Keep exploring in the format you need.
        </h2>
        <div className="mt-7 flex flex-wrap gap-x-6 gap-y-4 text-sm">
          <a href={externalLinks.github} onClick={() => trackCta("open_github", externalLinks.github)}>
            GitHub repository →
          </a>
          <a href={externalLinks.npm} onClick={() => trackCta("open_npm", externalLinks.npm)}>
            npm package →
          </a>
          <a href={externalLinks.videoGuide} onClick={() => trackCta("read_video_guide", externalLinks.videoGuide)}>
            English 360 video guide →
          </a>
          <a
            href={externalLinks.videoGuideChinese}
            onClick={() => trackCta("read_video_guide_zh", externalLinks.videoGuideChinese)}
          >
            中文 360 视频指南 →
          </a>
        </div>
      </section>

      <footer className={footerClassName}>
        <span>@ericchen1990/pano-view · React panorama components</span>
        <span>Images · video · cube tiles · hotspots</span>
      </footer>
    </main>
  );
}
