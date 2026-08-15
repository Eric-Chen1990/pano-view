export function PolygonDraftFields({
  kind,
  issueSummary,
  vertexCount,
}: {
  kind: "polygon" | "polyline";
  issueSummary: string | null;
  vertexCount: number;
}) {
  const minimumVertices = kind === "polygon" ? 3 : 2;
  const label = kind === "polygon" ? "Polygon" : "Polyline";
  return (
    <div className="inspector-content polygon-draft-fields">
      <p className="polygon-draft-count">{vertexCount} / {minimumVertices} minimum vertices</p>
      {issueSummary ? (
        <p className="polygon-validation invalid">{issueSummary}</p>
      ) : vertexCount >= minimumVertices ? (
        <p className="polygon-validation valid">{label} is ready. Finish it when ready.</p>
      ) : (
        <p className="polygon-validation">Click the panorama to add the next vertex.</p>
      )}
      <p className="polygon-keyboard-help">
        {kind === "polygon"
          ? "The third point closes the preview. Set fill opacity to 0% for an outline-only polygon."
          : "The path stays open: the final vertex never reconnects to the first."}
        {" "}Double-click or use Finish to complete. Esc cancels; Backspace removes the last point.
      </p>
    </div>
  );
}
