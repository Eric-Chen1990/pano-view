import { useEffect, useState } from "react";
import { PanoEditor } from "@ericchen1990/pano-editor";
import { parsePanoProject } from "@ericchen1990/pano-view/data";
import sampleProject from "../../../public/fixtures/projects/tour/project.json";
import "@ericchen1990/pano-editor/styles.css";
import { SiteHeader } from "../SiteHeader";
import { shellClassName } from "../../ui";

const demoProject = parsePanoProject(sampleProject);

export function EditorPage() {
  const [locale, setLocale] = useState<"en" | "zh-CN">("en");
  useEffect(() => {
    const previous = document.title;
    document.title = "Panorama editor · Pano View";
    return () => {
      document.title = previous;
    };
  }, []);
  return (
    <main className={shellClassName}>
      <SiteHeader />
      <div className="flex items-center justify-between gap-4 py-5">
        <p className="m-0 text-sm text-muted-2">
          {locale === "en"
            ? "Try the sample tour: edit hotspots, test click actions, and reuse shared popup content."
            : "直接试用示例导览：编辑热点、测试点击动作，并复用共享弹窗内容。"}
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
      <PanoEditor
        defaultValue={demoProject}
        baseUrl={new URL("/fixtures/projects/tour/", window.location.href).href}
        locale={locale}
        style={{ height: "min(860px, 85vh)", minHeight: 660 }}
      />
      <p className="mt-4 text-xs leading-6 text-muted-2">
        {locale === "en"
          ? "The sample is ready to edit. To add your own converted panorama, choose Add scene and drop its folder, including viewer.json, previews and tiles. Files are read locally; nothing is uploaded. Export a project package before leaving to include all resources, or export JSON for configuration only. Unzip a package before reopening its directory. Refreshing restores the sample."
          : "示例已准备好，可直接编辑。添加自己的切片场景时，点击“添加场景”并拖入包含 viewer.json、预览图和瓦片的文件夹。文件仅在本机读取，不会上传。离开前请导出项目包以包含全部资源，或仅导出配置 JSON。重新打开项目包前请先解压，再选择其目录；刷新会恢复示例。"}
      </p>
      <a
        className="mt-2 inline-block text-xs text-accent underline"
        href="/fixtures/editor-demo.zip"
        download
      >
        {locale === "en"
          ? "Download sample files (.zip) · unzip, then open the folder or drag it into Add scene"
          : "下载示例文件（.zip）· 解压后打开目录，或拖入“添加场景”"}
      </a>
    </main>
  );
}
