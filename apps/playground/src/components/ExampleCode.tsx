import { usePlaygroundLanguage } from "../i18n/language";
import { useEffect, useState, type ComponentProps } from "react";
import { segmentedButtonClassName } from "../ui";
import { CodeSnippet } from "./CodeSnippet";

const jsonLabels = {
  project: "Project JSON",
  viewer: "Viewer JSON",
  manifest: "Tile manifest",
} as const;

type Snippet = Pick<ComponentProps<typeof CodeSnippet>, "label" | "blurb" | "code">;
type JsonFile = Omit<Snippet, "code"> & ({ value: object } | { url: string });
type JsonFormat = keyof typeof jsonLabels;
export type ExampleJsonFormat = JsonFormat | "none";

function JsonSnippet({ label, blurb, url }: Omit<Snippet, "code"> & { url: string }) {
  const { t } = usePlaygroundLanguage();
  const [result, setResult] = useState<{ code: string } | { error: true }>();
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch(url, { signal: controller.signal });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const value: unknown = await response.json();
        if (value === null || typeof value !== "object") throw new Error("Expected a JSON document.");
        if (!controller.signal.aborted) setResult({ code: JSON.stringify(value, null, 2) });
      } catch {
        if (!controller.signal.aborted) setResult({ error: true });
      }
    }
    void load();
    return () => controller.abort();
  }, [url, attempt]);

  return (
    <div className="min-w-0">
      {result && "code" in result ? (
        <CodeSnippet label={label} blurb={blurb} code={result.code} language="json" />
      ) : result ? (
        <div className="flex flex-wrap items-center gap-3">
          <p role="alert">{t("Could not load {label}.", { label: t(label) })}</p>
          <button type="button" className={segmentedButtonClassName} onClick={() => {
            setResult(undefined);
            setAttempt((current) => current + 1);
          }}>{t("Retry")}</button>
        </div>
      ) : (
        <p role="status">{t("Loading {label}…", { label: t(label) })}</p>
      )}
      <a className="mt-2 inline-block text-sm text-accent underline" href={url}>{t("View source for {label}", { label: t(label) })}</a>
    </div>
  );
}

export function ExampleCode({ react, json }: {
  react: Snippet;
  json?: { format: JsonFormat; files: readonly JsonFile[] };
}) {
  const { t } = usePlaygroundLanguage();
  const [selected, setSelected] = useState<"react" | "json">("react");
  const showJson = selected === "json" && !!json?.files.length;

  return (
    <section aria-label={t("Example code")} className="grid min-w-0 gap-3 border-t border-line p-5 max-[760px]:p-3">
      {!!json?.files.length && (
        <div role="group" aria-label={t("Example code format")} className="flex flex-wrap gap-2">
          <button type="button" className={segmentedButtonClassName} aria-pressed={!showJson} onClick={() => setSelected("react")}>
            React JSX
          </button>
          <button type="button" className={segmentedButtonClassName} aria-pressed={showJson} onClick={() => setSelected("json")}>
            {t(jsonLabels[json.format])}
          </button>
        </div>
      )}
      {showJson && json ? json.files.map((file) => "url" in file ? (
        <JsonSnippet key={file.url} {...file} />
      ) : (
        <CodeSnippet key={file.label} label={file.label} blurb={file.blurb} code={JSON.stringify(file.value, null, 2)} language="json" />
      )) : (
        <CodeSnippet {...react} />
      )}
    </section>
  );
}
