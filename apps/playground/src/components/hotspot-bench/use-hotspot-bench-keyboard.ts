import { message } from "../../i18n/locale";
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
          lastAction: message("{type} draft cancelled.", { type: drawingPolyline ? "Polyline" : "Polygon" }),
        });
      }
      if (event.key === "Backspace") {
        event.preventDefault();
        useHotspotBenchStore.setState((state) => ({
          draftVertices: state.draftVertices.slice(0, -1),
          lastAction: message("Last {type} vertex removed.", { type: drawingPolyline ? "polyline" : "polygon" }),
        }));
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [drawingPath]);
}
