import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { Connect, Plugin } from "vite";
import type { PlaygroundLocale } from "./src/i18n/locale";
import { AI_DOC_PATHS } from "./src/links";
import { SITE_URL, type PlaygroundPath } from "./src/page-meta";

type LocalizedText = Record<PlaygroundLocale, string>;

const rawDocs = "https://raw.githubusercontent.com/Eric-Chen1990/pano-view/main/";
const quickstarts = [
  {
    topic: "react",
    label: { en: "React viewer quickstart", "zh-CN": "React 查看器快速入门（英文）" },
    note: { en: "Show a single 2:1 panorama and choose the right viewer for other media.", "zh-CN": "显示单张 2:1 全景图，并为其他媒体选择查看器。" },
  },
  {
    topic: "project",
    label: { en: "Static JSON tour quickstart", "zh-CN": "静态 JSON 漫游快速入门（英文）" },
    note: { en: "Load a two-scene project, resolve viewer.json files, and link scenes with a hotspot.", "zh-CN": "加载两场景项目、解析 viewer.json 并用热点切换场景。" },
  },
  {
    topic: "editor",
    label: { en: "Tour editor quickstart", "zh-CN": "漫游编辑器快速入门（英文）" },
    note: { en: "Embed the editor and connect host save, asset, and import callbacks.", "zh-CN": "嵌入编辑器并接入宿主的保存、资源选择和导入回调。" },
  },
  {
    topic: "converter",
    label: { en: "Image converter quickstart", "zh-CN": "图像转换器快速入门（英文）" },
    note: { en: "Convert and restore panoramic and flat images with the CLI or Node.js API.", "zh-CN": "使用 CLI 或 Node.js API 转换和还原全景图与平面图。" },
  },
];

const references = [
  {
    path: "packages/react/README",
    label: { en: "Viewer and project data reference", "zh-CN": "查看器与项目数据参考" },
    note: { en: "Public React APIs, project.json, viewer.json, and the /data entry point.", "zh-CN": "React 公共 API、project.json、viewer.json 和 /data 入口。" },
  },
  {
    path: "packages/editor/README",
    label: { en: "Editor reference", "zh-CN": "编辑器参考" },
    note: { en: "Embedding, local projects, export, and host integration.", "zh-CN": "嵌入、本地项目、导出和宿主集成。" },
  },
  {
    path: "packages/converter/README",
    label: { en: "Converter reference", "zh-CN": "转换器参考" },
    note: { en: "Node.js API, CLI flags, output formats, and troubleshooting.", "zh-CN": "Node.js API、CLI 参数、输出格式和故障排查。" },
  },
];

const examples = [
  { path: "/basics", label: { en: "Panorama sources", "zh-CN": "全景图源" } },
  { path: "/project", label: { en: "Static JSON tour", "zh-CN": "静态 JSON 漫游" } },
  { path: "/editor", label: { en: "Tour editor", "zh-CN": "漫游编辑器" } },
  { path: "/planar-image", label: { en: "Tiled flat image", "zh-CN": "平面瓦片图" } },
  { path: "/video", label: { en: "360° video", "zh-CN": "360° 视频" } },
] satisfies { path: PlaygroundPath; label: LocalizedText }[];

const guides = [
  { path: "docs/react-360-video", label: { en: "360° video guide", "zh-CN": "360° 视频指南" } },
  { path: "docs/krpano-migration", label: { en: "krpano tile migration guide", "zh-CN": "krpano 瓦片迁移指南" } },
  { path: "packages/react/docs/dialogs", label: { en: "Dialog integration guide", "zh-CN": "弹窗接入指南" } },
];

const indexCopy = {
  en: {
    summary: "Pano View is an open-source React viewer for panoramas, 360° video, and tiled flat images, with an embeddable tour editor and a Node.js image converter.",
    version: "Check the installed version of @ericchen1990/pano-view, @ericchen1990/pano-editor, or @ericchen1990/pano-converter and use its public types and matching release documentation. The linked references track the main branch.",
    quickstarts: "Quickstarts",
    reference: "API Reference",
    examples: "Playground Examples",
    full: "All four quickstarts in one file",
    alternate: "简体中文索引",
  },
  "zh-CN": {
    summary: "Pano View 是面向全景图、360° 视频和平面瓦片图的开源 React 查看器，配套可嵌入的漫游编辑器与 Node.js 图像转换器。",
    version: "先确认已安装的 @ericchen1990/pano-view、@ericchen1990/pano-editor 或 @ericchen1990/pano-converter 版本，再核对该版本的公共类型和发行文档。下方参考文档随 main 分支更新。",
    quickstarts: "快速入门",
    reference: "API 参考",
    examples: "Playground 示例",
    full: "四份快速入门合辑（英文）",
    alternate: "English index",
  },
};

function link(label: string, url: string, note?: string): string {
  return `- [${label}](${url})${note ? `: ${note}` : ""}`;
}

function siteLink(label: string, path: string, note?: string): string {
  return link(label, new URL(path, SITE_URL).href, note);
}

function quickstartPath(topic: string): string {
  return `/ai-docs/${topic}.md`;
}

function renderIndex(locale: PlaygroundLocale): string {
  const copy = indexCopy[locale];
  const suffix = locale === "en" ? ".md" : ".zh-CN.md";
  return [
    "# Pano View",
    "",
    `> ${copy.summary}`,
    "",
    copy.version,
    "",
    `## ${copy.quickstarts}`,
    "",
    ...quickstarts.map(({ topic, label, note }) => siteLink(label[locale], quickstartPath(topic), note[locale])),
    siteLink(copy.full, AI_DOC_PATHS.full),
    "",
    `## ${copy.reference}`,
    "",
    ...references.map(({ path, label, note }) => link(label[locale], rawDocs + path + suffix, note[locale])),
    "",
    `## ${copy.examples}`,
    "",
    ...examples.map(({ path, label }) => siteLink(label[locale], path)),
    "",
    "## Optional",
    "",
    ...guides.map(({ path, label }) => link(label[locale], rawDocs + path + suffix)),
    link(locale === "en" ? "Online scene map guide" : "在线场景地图指南（英文）", rawDocs + "packages/react/docs/geo-map.md"),
    link(locale === "en" ? "Agent Skills installation" : "安装 Agent Skills", rawDocs + "README" + suffix),
    siteLink(copy.alternate, AI_DOC_PATHS[locale === "en" ? "zh-CN" : "en"]),
    "",
  ].join("\n");
}

function readQuickstart(topic: string): Promise<string> {
  return readFile(new URL(`../../skills/pano-view-${topic}/references/quickstart.md`, import.meta.url), "utf8");
}

async function renderFull(): Promise<string> {
  const sections = await Promise.all(quickstarts.map(async ({ topic }) =>
    (await readQuickstart(topic)).trimEnd().replace(/^# /, "## "),
  ));
  return [
    "# Pano View Quickstarts",
    indexCopy.en.version,
    sections.join("\n\n"),
    siteLink("Documentation index", AI_DOC_PATHS.en),
    "",
  ].join("\n\n");
}

const documents = new Map<string, () => string | Promise<string>>([
  [AI_DOC_PATHS.en, () => renderIndex("en")],
  [AI_DOC_PATHS["zh-CN"], () => renderIndex("zh-CN")],
  [AI_DOC_PATHS.full, renderFull],
  ...quickstarts.map(({ topic }) => [quickstartPath(topic), () => readQuickstart(topic)] as const),
]);

function serveDocs(readDocument: (path: string, render: () => string | Promise<string>) => string | Promise<string>): Connect.NextHandleFunction {
  return async (request, response, next) => {
    const path = request.url?.split("?", 1)[0] ?? "";
    const render = documents.get(path);
    if (!render) return next();
    if (request.method !== "GET" && request.method !== "HEAD") {
      response.writeHead(405, { Allow: "GET, HEAD" }).end();
      return;
    }

    try {
      const source = await readDocument(path, render);
      const mediaType = path.endsWith(".md") ? "text/markdown" : "text/plain";
      response.writeHead(200, {
        "Content-Type": `${mediaType}; charset=utf-8`,
        "Content-Length": Buffer.byteLength(source),
      });
      response.end(request.method === "HEAD" ? undefined : source);
    } catch (error) {
      next(error);
    }
  };
}

export function playgroundAiDocs(): Plugin {
  return {
    name: "playground-ai-docs",
    configureServer(server) {
      server.middlewares.use(serveDocs((_path, render) => render()));
    },
    configurePreviewServer(server) {
      const outDir = resolve(server.config.root, server.config.build.outDir);
      server.middlewares.use(serveDocs((path) => readFile(resolve(outDir, path.slice(1)), "utf8")));
    },
    async generateBundle() {
      for (const [path, render] of documents) {
        this.emitFile({ type: "asset", fileName: path.slice(1), source: await render() });
      }
    },
  };
}
