import { usePlaygroundLanguage } from "../i18n/language";
import { Highlight, themes } from "prism-react-renderer";
import { useEffect, useRef, useState } from "react";

export function CodeSnippet({
  blurb,
  code,
  label,
  language = "tsx",
  onCopy,
}: {
  blurb: string;
  code: string;
  label: string;
  language?: string;
  onCopy?: () => void;
}) {
  const { t } = usePlaygroundLanguage();
  const [copyStatus, setCopyStatus] = useState<{ code: string; copied: boolean }>();
  const copiedTimerRef = useRef<number>(0);
  const status = copyStatus?.code === code ? copyStatus : undefined;

  useEffect(() => {
    return () => window.clearTimeout(copiedTimerRef.current);
  }, []);

  return (
    <div className="min-w-0 border border-[#244047] bg-[#081619]/80">
      <div className="flex items-start justify-between gap-4 border-b border-[#244047] px-5 py-4 max-[760px]:flex-col">
        <div className="min-w-0 max-w-full">
          <span className="block text-[0.82rem] font-semibold tracking-[0.02em] text-[#f5fbfc]">
            {t(label)}
          </span>
          <p className="m-0 mt-1 wrap-anywhere text-[0.72rem] leading-6 text-[#88a6ac]">{t(blurb)}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="rounded border border-[#3e6c73] px-2 py-1 font-mono text-[0.58rem] uppercase tracking-[0.08em] text-[#75cbd3]">
            {language}
          </span>
          <button
            className="border border-[#3e6c73] px-2.5 py-1.5 text-[0.7rem] font-medium text-[#f5fbfc] transition hover:border-[#75cbd3] focus-visible:outline-2 focus-visible:outline-offset-2"
            onClick={async () => {
              window.clearTimeout(copiedTimerRef.current);
              try {
                await navigator.clipboard.writeText(code);
                setCopyStatus({ code, copied: true });
                copiedTimerRef.current = window.setTimeout(() => setCopyStatus(undefined), 1600);
              } catch {
                setCopyStatus({ code, copied: false });
                return;
              }
              onCopy?.();
            }}
            type="button"
          >
            {status?.copied ? t("Copied") : t("Copy")}
          </button>
        </div>
      </div>
      <span role="status" className={status?.copied === false ? "block px-5 py-2 text-sm" : "sr-only"}>
        {status ? status.copied ? t("Code copied.") : t("Could not copy. Select the code to copy it manually.") : ""}
      </span>
      <Highlight code={code} language={language} theme={themes.oneDark}>
        {({ className, style, tokens, getLineProps, getTokenProps }) => (
          <pre
            className={`${className} m-0 overflow-x-auto px-5 py-4 text-[0.78rem] leading-6`}
            style={style}
            tabIndex={0}
          >
            <code>
              {tokens.map((line, lineIndex) => (
                <div {...getLineProps({ line })} key={lineIndex}>
                  {line.map((token, tokenIndex) => (
                    <span {...getTokenProps({ token })} key={tokenIndex} />
                  ))}
                </div>
              ))}
            </code>
          </pre>
        )}
      </Highlight>
    </div>
  );
}
