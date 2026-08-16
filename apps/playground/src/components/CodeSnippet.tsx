import { Highlight, themes } from "prism-react-renderer";
import { useEffect, useRef, useState } from "react";

export function CodeSnippet({
  blurb,
  code,
  label,
  language = "tsx",
}: {
  blurb: string;
  code: string;
  label: string;
  language?: string;
}) {
  const [copied, setCopied] = useState(false);
  const copiedTimerRef = useRef<number>(0);

  useEffect(() => {
    return () => window.clearTimeout(copiedTimerRef.current);
  }, []);

  return (
    <div className="code-snippet">
      <div className="code-snippet-header">
        <div>
          <span className="code-snippet-title">{label}</span>
          <p>{blurb}</p>
        </div>
        <div className="code-snippet-actions">
          <span className="code-snippet-lang">{language}</span>
          <button
            onClick={() => {
              void navigator.clipboard.writeText(code).then(() => {
                setCopied(true);
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
          <pre className={className} style={style} tabIndex={0}>
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
