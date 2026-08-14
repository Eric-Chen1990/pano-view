import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { PanoView } from "@pano-view/react";
import "./styles.css";

function App() {
  return (
    <main className="page-shell">
      <header className="masthead">
        <a className="wordmark" href="#top" aria-label="Pano View playground home">
          PANO<span>/</span>VIEW
        </a>
        <p>React component workspace</p>
      </header>

      <section className="intro" id="top" aria-labelledby="page-title">
        <div>
          <p className="eyebrow">Component 001 — unstyled root</p>
          <h1 id="page-title">Frame the view<br />before the view exists.</h1>
        </div>
        <p className="lede">
          The first public surface of <code>@pano-view/react</code> is a quiet,
          flexible container. Style the frame today; add the panorama engine
          when it is ready.
        </p>
      </section>

      <section className="viewer-section" aria-label="PanoView component preview">
        <div className="viewer-meta">
          <span>LIVE FRAME</span>
          <span>360° / 00:00</span>
        </div>
        <PanoView className="hero-view" aria-label="Styled PanoView placeholder">
          <div className="horizon" aria-hidden="true" />
          <div className="reticle" aria-hidden="true" />
          <p>Drop a renderer here.</p>
        </PanoView>
        <div className="viewer-caption">
          <span>Panoramic canvas reserved</span>
          <span>React 18–19</span>
        </div>
      </section>

      <section className="examples" aria-labelledby="examples-title">
        <div className="section-heading">
          <p className="eyebrow">Three small guarantees</p>
          <h2 id="examples-title">It behaves like a div.</h2>
        </div>

        <div className="example-grid">
          <article>
            <p className="example-label">Default</p>
            <PanoView className="empty-frame" aria-label="Empty PanoView example" />
            <code>{"<PanoView />"}</code>
          </article>
          <article>
            <p className="example-label">Children</p>
            <PanoView className="content-frame">
              <span>Scene content</span>
            </PanoView>
            <code>{"<PanoView>…</PanoView>"}</code>
          </article>
          <article>
            <p className="example-label">className</p>
            <PanoView className="accent-frame">
              <span>Application styles</span>
            </PanoView>
            <code>{'className="…"'}</code>
          </article>
        </div>
      </section>

      <footer>
        <span>Source alias → packages/react/src</span>
        <span>v0.0.0 placeholder</span>
      </footer>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
