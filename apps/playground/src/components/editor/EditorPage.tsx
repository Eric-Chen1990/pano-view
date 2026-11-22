import { useEffect, useMemo, useState } from "react";
import { PanoEditor } from "@ericchen1990/pano-editor";
import {
  PanoDataError,
  parsePanoProject,
  type PanoProjectDefinition,
} from "@ericchen1990/pano-view/data";
import "@ericchen1990/pano-editor/styles.css";
import "@ericchen1990/pano-view/ui/styles.css";
import { ExampleCode } from "../ExampleCode";
import { SiteFooter } from "../SiteFooter";
import { SiteHeader } from "../SiteHeader";
import { shellClassName } from "../../ui";

const sampleProjectUrl = "/fixtures/projects/editor/v4/project.json";

function buildEditorSnippet(locale: "en" | "zh-CN"): string {
  return `import { useEffect, useState } from "react";
import { PanoEditor } from "@ericchen1990/pano-editor";
import {
  parsePanoProject,
  type PanoProjectDefinition,
} from "@ericchen1990/pano-view/data";
import "@ericchen1990/pano-view/styles.css";
import "@ericchen1990/pano-editor/styles.css";
import "@ericchen1990/pano-view/ui/styles.css";

const projectUrl = ${JSON.stringify(sampleProjectUrl)};

export function TourEditor() {
  const [project, setProject] = useState<PanoProjectDefinition>();
  const [error, setError] = useState<string>();
  useEffect(() => {
    const controller = new AbortController();
    fetch(projectUrl, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error("Could not load project.json");
        return response.json();
      })
      .then((value: unknown) => {
        if (!controller.signal.aborted) setProject(parsePanoProject(value));
      })
      .catch((error: Error) => {
        if (!controller.signal.aborted) setError(error.message);
      });
    return () => controller.abort();
  }, []);

  if (error) return <p role="alert">{error}</p>;
  if (!project) return <p role="status">Loading tour…</p>;

  return (
    <PanoEditor
      defaultValue={project}
      baseUrl={new URL(".", new URL(projectUrl, window.location.href)).href}
      locale="${locale}"
      style={{ height: "min(860px, 85vh)", minHeight: 660 }}
    />
  );
}`;
}

export function EditorPage() {
  const [locale, setLocale] = useState<"en" | "zh-CN">("en");
  const [project, setProject] = useState<PanoProjectDefinition>();
  const [error, setError] = useState<string>();
  const snippet = useMemo(() => buildEditorSnippet(locale), [locale]);
  useEffect(() => {
    const controller = new AbortController();
    fetch(sampleProjectUrl, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok)
          throw new Error(`Failed to load sample project (${response.status})`);
        return response.json() as Promise<unknown>;
      })
      .then((value) => {
        if (controller.signal.aborted) return;
        setProject(parsePanoProject(value));
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return;
        setError(
          cause instanceof PanoDataError
            ? `${cause.code}: ${cause.message}`
            : cause instanceof Error
              ? cause.message
              : String(cause),
        );
      });
    return () => controller.abort();
  }, []);
  return (
    <main className={shellClassName}>
      <SiteHeader />
      <h1 className="mb-0 mt-8 text-3xl font-bold">Tour editor</h1>
      <div className="flex flex-wrap items-center justify-between gap-4 py-5">
        <p className="m-0 text-sm text-muted-2">
          {locale === "en"
            ? "Select the image or video hotspot in Entrance to drag its corners or rotate it. Click the video in Preview to play it."
            : "在入口场景选中图片或视频热点，即可拖动四角或旋转。在预览中点击视频即可播放。"}
        </p>
        <label className="shrink-0 text-xs text-muted-2">
          Language{" "}
          <select
            className="ml-2 border border-line bg-canvas-2 px-2 py-1 text-ink"
            value={locale}
            onChange={(event) =>
              setLocale(event.currentTarget.value as "en" | "zh-CN")
            }
          >
            <option value="en">English</option>
            <option value="zh-CN">简体中文</option>
          </select>
        </label>
      </div>
      {error ? (
        <p role="alert" className="m-0 text-sm text-muted-2">
          {error}
        </p>
      ) : project ? (
        <PanoEditor
          defaultValue={project}
          baseUrl={new URL(".", new URL(sampleProjectUrl, window.location.href)).href}
          locale={locale}
          style={{ height: "min(860px, 85vh)", minHeight: 660 }}
        />
      ) : (
        <p role="status" className="m-0 text-sm text-muted-2">
          {locale === "en" ? "Loading sample…" : "正在加载示例…"}
        </p>
      )}
      <p className="mt-4 text-xs leading-6 text-muted-2">
        {locale === "en"
          ? "The sample is ready to edit. To add your own converted panorama, choose Add scene and drop its folder, including viewer.json, previews and tiles. Files are read locally; nothing is uploaded. Export a project package before leaving to include all resources, or export JSON for configuration only. Unzip a package before reopening its directory. Refreshing restores the sample."
          : "示例已准备好，可直接编辑。添加自己的切片场景时，点击“添加场景”并拖入包含 viewer.json、预览图和瓦片的文件夹。文件仅在本机读取，不会上传。离开前请导出项目包以包含全部资源，或仅导出配置 JSON。重新打开项目包前请先解压，再选择其目录；刷新会恢复示例。"}
      </p>
      <a
        className="mt-2 inline-block text-xs text-accent underline"
        href="/fixtures/editor-demo-v4.zip"
        download
      >
        {locale === "en"
          ? "Download sample files (.zip) · unzip, then open the folder or drag it into Add scene"
          : "下载示例文件（.zip）· 解压后打开目录，或拖入“添加场景”"}
      </a>
      <div className="mt-6">
        <ExampleCode
          json={{ format: "project", files: [{ label: "project.json", blurb: "Load this file with parsePanoProject. Resolve relative assets from the directory containing the file.", url: sampleProjectUrl }] }}
          react={{
            blurb: "Embed PanoEditor with a parsed project document and a base URL for panorama and hotspot assets. locale switches the built-in UI strings.",
            code: snippet,
            label: "PanoEditor",
          }}
        />
      </div>
      <SiteFooter label="@ericchen1990/pano-view · tour editor" />
    </main>
  );
}
