import type { PanoProjectDefinition } from "@ericchen1990/pano-view/data";

/** One history per mounted editor. A gesture can publish live frames with a single undo entry. */
export class DocumentHistory {
  past: PanoProjectDefinition[] = [];
  future: PanoProjectDefinition[] = [];
  private gesture?: PanoProjectDefinition;
  constructor(public current: PanoProjectDefinition) {}
  replace(next: PanoProjectDefinition) {
    this.current = next;
    this.past = [];
    this.future = [];
    this.gesture = undefined;
  }
  begin() {
    this.gesture ??= this.current;
  }
  end() {
    const before = this.gesture;
    this.gesture = undefined;
    if (before && JSON.stringify(before) !== JSON.stringify(this.current)) {
      this.past.push(before);
      this.past = this.past.slice(-100);
      this.future = [];
    }
  }
  commit(next: PanoProjectDefinition) {
    if (JSON.stringify(next) === JSON.stringify(this.current)) return false;
    if (!this.gesture) {
      this.past.push(this.current);
      this.past = this.past.slice(-100);
      this.future = [];
    }
    this.current = next;
    return true;
  }
  undo() {
    this.end();
    const next = this.past.pop();
    if (next) {
      this.future.push(this.current);
      this.current = next;
    }
    return this.current;
  }
  redo() {
    this.end();
    const next = this.future.pop();
    if (next) {
      this.past.push(this.current);
      this.current = next;
    }
    return this.current;
  }
}
