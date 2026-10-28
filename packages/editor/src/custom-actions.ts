import { hotspotAction, projectHotspotTriggers, type PanoProjectDefinition, type ProjectCustomHotspotAction, type JsonObject } from "@ericchen1990/pano-view/data";

export type PanoCustomActionField = {
  name: string;
  label: string;
  type: "string" | "textarea" | "number" | "boolean" | "select";
  required?: boolean;
  min?: number;
  max?: number;
  options?: string[];
  defaultValue?: string | number | boolean;
};
export type PanoCustomActionDefinition = { id: string; label: string; description?: string; fields: PanoCustomActionField[] };
export function customActionDefaults(definition: PanoCustomActionDefinition): JsonObject {
  return Object.fromEntries(definition.fields.filter(field => field.defaultValue !== undefined).map(field => [field.name, field.defaultValue!]));
}
export function customActionIssue(action: ProjectCustomHotspotAction, definitions: readonly PanoCustomActionDefinition[] = []): string | undefined {
  const definition = definitions.find(item => item.id === action.actionId);
  if (!definition) return;
  for (const field of definition.fields) {
    const value = action.params?.[field.name];
    const absent = value === undefined || value === null || (typeof value === "string" && !value.trim());
    if (absent) { if (field.required) return `${field.label}: Required`; continue; }
    const valid = field.type === "number" ? typeof value === "number" && Number.isFinite(value) && (field.min === undefined || value >= field.min) && (field.max === undefined || value <= field.max)
      : field.type === "boolean" ? typeof value === "boolean"
      : typeof value === "string" && (field.type !== "select" || Boolean(field.options?.includes(value)));
    if (!valid) return `${field.label}: Invalid value`;
  }
}
export function validateCustomActions(project: PanoProjectDefinition, definitions?: readonly PanoCustomActionDefinition[]) {
  for (const scene of project.scenes) for (const hotspot of scene.hotspots ?? []) for (const trigger of projectHotspotTriggers) {
    const action = hotspotAction(hotspot, trigger);
    const issue = action?.type === "custom" ? customActionIssue(action, definitions) : undefined;
    if (issue) throw new Error(`${scene.id}/${hotspot.id}/${trigger}: ${issue}`);
  }
}
