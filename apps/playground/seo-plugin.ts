import type { Plugin } from "vite";
import { PAGE_META, SITE_URL, type PlaygroundPath } from "./src/page-meta";

const SEO_BLOCK = /<!-- playground:seo:start -->[\s\S]*?<!-- playground:seo:end -->/;

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]!);
}

function renderSeo(path: PlaygroundPath): string {
  const { title, description } = PAGE_META[path];
  const canonical = new URL(path, SITE_URL).href;
  const image = `${SITE_URL}/og-image.jpg`;
  const imageAlt = "Pano View React panorama viewer with a thumbnail scene menu and a lakeside 360° scene";
  const tags = [
    `<title>${escapeHtml(title)}</title>`,
    `<meta name="description" content="${escapeHtml(description)}" />`,
    `<link rel="canonical" href="${canonical}" />`,
    '<meta property="og:type" content="website" />',
    '<meta property="og:site_name" content="Pano View" />',
    `<meta property="og:title" content="${escapeHtml(title)}" />`,
    `<meta property="og:description" content="${escapeHtml(description)}" />`,
    `<meta property="og:url" content="${canonical}" />`,
    `<meta property="og:image" content="${image}" />`,
    '<meta property="og:image:type" content="image/jpeg" />',
    '<meta property="og:image:width" content="1920" />',
    '<meta property="og:image:height" content="1080" />',
    `<meta property="og:image:alt" content="${escapeHtml(imageAlt)}" />`,
    '<meta name="twitter:card" content="summary_large_image" />',
    '<meta name="twitter:site" content="@EricChen_Dev" />',
    `<meta name="twitter:title" content="${escapeHtml(title)}" />`,
    `<meta name="twitter:description" content="${escapeHtml(description)}" />`,
    `<meta name="twitter:image" content="${image}" />`,
    `<meta name="twitter:image:alt" content="${escapeHtml(imageAlt)}" />`,
  ];
  if (path === "/") {
    const structuredData = {
      "@context": "https://schema.org",
      "@type": "SoftwareSourceCode",
      name: "Pano View",
      url: canonical,
      description,
      image,
      codeRepository: "https://github.com/Eric-Chen1990/pano-view",
      programmingLanguage: ["TypeScript", "JavaScript"],
      runtimePlatform: "React",
      license: "https://opensource.org/license/mit/",
    };
    tags.push(`<script type="application/ld+json">${JSON.stringify(structuredData).replace(/</g, "\\u003c")}</script>`);
  }
  return `<!-- playground:seo:start -->\n    ${tags.join("\n    ")}\n    <!-- playground:seo:end -->`;
}

function withSeo(html: string, path: PlaygroundPath): string {
  if (!SEO_BLOCK.test(html)) throw new Error("Missing playground SEO block in index.html");
  return html.replace(SEO_BLOCK, () => renderSeo(path));
}

function pathForUrl(url: string): PlaygroundPath {
  const pathname = new URL(url, SITE_URL).pathname.replace(/\/$/, "") || "/";
  return Object.prototype.hasOwnProperty.call(PAGE_META, pathname) ? pathname as PlaygroundPath : "/";
}

export function playgroundSeo(): Plugin {
  const paths = Object.keys(PAGE_META) as PlaygroundPath[];
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${paths.map((path) => `  <url><loc>${new URL(path, SITE_URL).href}</loc></url>`).join("\n")}\n</urlset>\n`;
  const robots = `User-agent: *\nAllow: /\n\nSitemap: ${SITE_URL}/sitemap.xml\n`;
  return {
    name: "playground-seo",
    transformIndexHtml(html, context) {
      return withSeo(html, pathForUrl(context.originalUrl ?? context.path));
    },
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const path = request.url?.split("?")[0];
        if (path !== "/robots.txt" && path !== "/sitemap.xml") return next();
        response.setHeader("Content-Type", path === "/robots.txt" ? "text/plain; charset=utf-8" : "application/xml; charset=utf-8");
        response.end(path === "/robots.txt" ? robots : sitemap);
      });
    },
    generateBundle: {
      order: "post",
      handler(_options, bundle) {
        const index = bundle["index.html"];
        if (!index || index.type !== "asset" || typeof index.source !== "string") {
          this.error("Missing playground index.html build output");
        }
        // Static metadata is available to sharing crawlers without executing React.
        for (const path of paths) {
          if (path === "/") continue;
          this.emitFile({ type: "asset", fileName: `${path.slice(1)}.html`, source: withSeo(index.source, path) });
        }
        this.emitFile({ type: "asset", fileName: "robots.txt", source: robots });
        this.emitFile({ type: "asset", fileName: "sitemap.xml", source: sitemap });
      },
    },
  };
}
