import { useEffect } from "react";
import { selectDrawingPath, useHotspotBenchStore } from "./store";

export function useHotspotBenchKeyboard() {
  const drawingPath = useHotspotBenchStore(selectDrawingPath);

  useEffect(() => {
    if (!drawingPath) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLSelectElement ||
        target instanceof HTMLTextAreaElement
      ) {
        return;
      }
      const drawingPolyline = useHotspotBenchStore.getState().tool === "polyline";
      if (event.key === "Escape") {
        event.preventDefault();
        useHotspotBenchStore.setState({
          draftVertices: [],
          tool: "navigate",
          lastAction: `${drawingPolyline ? "Polyline" : "Polygon"} draft cancelled.`,
        });
      }
      if (event.key === "Backspace") {
        event.preventDefault();
        useHotspotBenchStore.setState((state) => ({
          draftVertices: state.draftVertices.slice(0, -1),
          lastAction: `Last ${drawingPolyline ? "polyline" : "polygon"} vertex removed.`,
        }));
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [drawingPath]);
}
