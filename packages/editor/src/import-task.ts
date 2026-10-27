import type { PanoEditorProps, PanoImportProgress } from "./types";
import type { PanoProjectSceneDefinition } from "@ericchen1990/pano-view/data";

/** Host requests can outlive cancellation; generation checks prevent late scene insertion. */
export class ImportTask {
  private controller?: AbortController;
  cancel() {
    this.controller?.abort();
    this.controller = undefined;
  }
  async run(
    file: File,
    callback: NonNullable<PanoEditorProps["onImportPanorama"]>,
    progress: (event: PanoImportProgress) => void,
    validate: (
      source: PanoProjectSceneDefinition["source"],
      signal: AbortSignal,
    ) => Promise<void>,
  ): Promise<PanoProjectSceneDefinition["source"] | undefined> {
    this.cancel();
    const controller = new AbortController();
    this.controller = controller;
    try {
      const source = await callback(file, {
        signal: controller.signal,
        onProgress: (event) => {
          if (this.controller === controller && !controller.signal.aborted)
            progress({
              ...event,
              progress:
                event.progress === undefined || !Number.isFinite(event.progress)
                  ? undefined
                  : Math.max(0, Math.min(1, event.progress)),
            });
        },
      });
      if (this.controller !== controller || controller.signal.aborted)
        return undefined;
      await validate(source, controller.signal);
      if (this.controller !== controller || controller.signal.aborted)
        return undefined;
      return source;
    } catch (error) {
      if (this.controller !== controller || controller.signal.aborted)
        return undefined;
      throw error;
    } finally {
      if (this.controller === controller) this.controller = undefined;
    }
  }
}
