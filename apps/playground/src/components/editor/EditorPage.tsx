import { useEffect, useState } from "react";
import { PanoEditor } from "@ericchen1990/pano-editor";
import "@ericchen1990/pano-editor/styles.css";
import { SiteHeader } from "../SiteHeader";
import { shellClassName } from "../../ui";

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
            ? "Open a local tour. Shape the scenes. Take the JSON with you."
            : "打开本地导览，编辑场景与热点，带走 JSON 配置。"}
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
        locale={locale}
        style={{ height: "min(860px, 85vh)", minHeight: 660 }}
      />
      <p className="mt-4 text-xs leading-6 text-muted-2">
        {locale === "en"
          ? "Run pano-convert locally first. Select your project root, edit, and put the exported project.json back in that directory. Serve it over HTTP to play your tour. Refreshing this page clears the session."
          : "请先在本地运行 pano-convert，选择项目根目录，编辑后将导出的 project.json 放回该目录，通过 HTTP 静态服务播放。刷新页面会清空当前会话。"}
      </p>
    </main>
  );
}
