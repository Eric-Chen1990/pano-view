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
  const [copied, setCopied] = useState(false);
  const copiedTimerRef = useRef<number>(0);

  useEffect(() => {
    return () => window.clearTimeout(copiedTimerRef.current);
  }, []);

  return (
    <div className="border border-[#244047] bg-[#081619]/80">
      <div className="flex items-start justify-between gap-4 border-b border-[#244047] px-5 py-4 max-[760px]:flex-col">
        <div>
          <span className="block text-[0.82rem] font-semibold tracking-[0.02em] text-[#f5fbfc]">
            {label}
          </span>
          <p className="m-0 mt-1 text-[0.72rem] leading-6 text-[#88a6ac]">{blurb}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="rounded border border-[#3e6c73] px-2 py-1 font-mono text-[0.58rem] uppercase tracking-[0.08em] text-[#75cbd3]">
            {language}
          </span>
          <button
            className="border border-[#3e6c73] px-2.5 py-1.5 text-[0.7rem] font-medium text-[#f5fbfc] transition hover:border-[#75cbd3]"
            onClick={() => {
              void navigator.clipboard.writeText(code).then(() => {
                setCopied(true);
                onCopy?.();
                window.clearTimeout(copiedTimerRef.current);
                copiedTimerRef.current = window.setTimeout(() => setCopied(false), 1600);
              });
            }}
            type="button"
          >
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      </div>
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
