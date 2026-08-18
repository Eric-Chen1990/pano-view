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
    <div className="grid gap-[14px] p-[17px]">
      <p className="m-0 font-mono text-[0.82rem] text-[#dcecef]">
        {vertexCount} / {minimumVertices} minimum vertices
      </p>
      {issueSummary ? (
        <p className="m-0 border-l-2 border-[#df6b42] pl-[9px] text-[0.73rem] leading-[1.5] text-[#f2b4a3]">
          {issueSummary}
        </p>
      ) : vertexCount >= minimumVertices ? (
        <p className="m-0 text-[0.73rem] leading-[1.5] text-[#9bd7ba]">
          {label} is ready. Finish it when ready.
        </p>
      ) : (
        <p className="m-0 text-[0.73rem] leading-[1.5] text-[#88a6ac]">
          Click the panorama to add the next vertex.
        </p>
      )}
      <p className="m-0 text-[0.73rem] leading-[1.5] text-[#88a6ac]">
        {kind === "polygon"
          ? "The third point closes the preview. Set fill opacity to 0% for an outline-only polygon."
          : "The path stays open: the final vertex never reconnects to the first."}{" "}
        Double-click or use Finish to complete. Esc cancels; Backspace removes the
        last point.
      </p>
    </div>
  );
}
