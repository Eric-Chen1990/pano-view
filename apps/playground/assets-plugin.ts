import { createHash } from "node:crypto";
import { Agent } from "node:https";
import type { Plugin, ProxyOptions } from "vite";
import vercelConfig from "./vercel.json";

const assetRewrite = vercelConfig.rewrites.find(({ destination }) => destination.endsWith("/:asset"));
if (!assetRewrite) throw new Error("Missing Playground asset rewrite in vercel.json");
const assetBaseUrl = assetRewrite.destination.replace(/:asset$/, "");
const embedPath = "/fixtures/hotspots/embed.html";
const cleanEmbedPath = "/fixtures/hotspots/embed";
const embedSha256 = "1d3504d2f1299c2759856f74a79e21da465dbb1b709797a7a8fb6b8691e2d481";

export const assetProxy: Record<string, ProxyOptions> = {
  "^/(?:fixtures/(?!hotspots/embed(?:\\.html)?(?:[/?]|$))|(?:apple-touch-icon\\.png|favicon\\.ico|logo\\.png|og-image\\.jpg)(?:\\?|$))": {
    target: assetBaseUrl,
    changeOrigin: true,
    agent: new Agent({ keepAlive: true }),
  },
};

export function playgroundAssets(): Plugin {
  let embed: Promise<Buffer> | undefined;

  async function fetchEmbed(): Promise<Buffer> {
    const response = await fetch(new URL(embedPath.slice(1), assetBaseUrl), {
      redirect: "error",
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw new Error(`Could not load Playground iframe fixture (HTTP ${response.status})`);
    const html = Buffer.from(await response.arrayBuffer());
    // Verify the uploaded HTML before serving it on the Playground origin.
    if (createHash("sha256").update(html).digest("hex") !== embedSha256) {
      throw new Error("Playground iframe fixture failed integrity verification");
    }
    return html;
  }

  function loadEmbed(): Promise<Buffer> {
    embed ??= fetchEmbed().catch((error: unknown) => {
      embed = undefined;
      throw error;
    });
    return embed;
  }

  return {
    name: "playground-assets",
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        const pathname = request.url?.split("?", 1)[0];
        if (pathname !== embedPath && pathname !== cleanEmbedPath) return next();
        if (request.method !== "GET" && request.method !== "HEAD") {
          response.writeHead(405, { Allow: "GET, HEAD" }).end();
          return;
        }

        try {
          const html = await loadEmbed();
          response.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Content-Length": html.length });
          response.end(request.method === "HEAD" ? undefined : html);
        } catch (error) {
          server.config.logger.error(String(error));
          response.writeHead(502, { "Content-Type": "text/plain; charset=utf-8" });
          response.end("Unable to load the Playground iframe fixture.");
        }
      });
    },
    async generateBundle() {
      // Blob serves HTML as a download. Emit the verified fixture for the iframe.
      this.emitFile({ type: "asset", fileName: embedPath.slice(1), source: await loadEmbed() });
    },
  };
}
